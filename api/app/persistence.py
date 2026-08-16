"""File-backed repository (DB tier) — mirrors fileRepository.ts/factory.ts.

Stores one JSON file per collection under the configured data root. A process
lock serializes writes (single-instance dev/demo). Entities are plain dicts
with an ``id`` key, matching the JSON store used by the TypeScript API.
"""
import json
import os
import threading
from pathlib import Path
from typing import Callable, Dict, List, Optional

from .config import API_DIR, CONFIG

_data_root_cfg = CONFIG["persistence"]["file"]["dataRoot"]
_data_root = Path(_data_root_cfg)
if not _data_root.is_absolute():
    # Config dataRoot (e.g. "api/data") is repo-root relative, like the TS process.cwd().
    _data_root = (API_DIR.parent / _data_root_cfg).resolve()
_data_root.mkdir(parents=True, exist_ok=True)

_lock = threading.Lock()

Entity = Dict[str, object]


class FileRepository:
    def __init__(self, collection: str) -> None:
        self._path = _data_root / f"{collection}.json"

    def _read(self) -> List[Entity]:
        if not self._path.exists():
            return []
        try:
            with open(self._path, "r", encoding="utf-8") as f:
                parsed = json.load(f)
            return parsed if isinstance(parsed, list) else []
        except (json.JSONDecodeError, OSError):
            return []

    def _write(self, items: List[Entity]) -> None:
        tmp = self._path.with_suffix(".json.tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(items, f, indent=2)
        os.replace(tmp, self._path)

    def get_all(self) -> List[Entity]:
        with _lock:
            return self._read()

    def get_by_id(self, entity_id: str) -> Optional[Entity]:
        return next((i for i in self.get_all() if i.get("id") == entity_id), None)

    def find(self, predicate: Callable[[Entity], bool]) -> List[Entity]:
        return [i for i in self.get_all() if predicate(i)]

    def upsert(self, item: Entity) -> Entity:
        with _lock:
            items = self._read()
            idx = next((n for n, i in enumerate(items) if i.get("id") == item.get("id")), -1)
            if idx >= 0:
                items[idx] = item
            else:
                items.append(item)
            self._write(items)
        return item

    def delete(self, entity_id: str) -> bool:
        with _lock:
            items = self._read()
            nxt = [i for i in items if i.get("id") != entity_id]
            removed = len(nxt) != len(items)
            if removed:
                self._write(nxt)
        return removed


_cache: Dict[str, FileRepository] = {}


def get_repository(collection: str) -> FileRepository:
    repo = _cache.get(collection)
    if repo is None:
        repo = FileRepository(collection)
        _cache[collection] = repo
    return repo
