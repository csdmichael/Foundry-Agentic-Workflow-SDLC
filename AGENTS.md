# Agent Development Guidance

This project was built with the microsoft-foundry skill. Before working on or answering questions about Foundry agents, read the microsoft-foundry skill first.

All model calls must continue to route through the configured Azure API Management gateway. Microsoft Agent Framework owns workflow topology and human-in-the-loop pause/resume behavior; the APIM client remains the model execution boundary.