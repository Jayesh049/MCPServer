"""FastAPI RAG agent: Wikipedia + TF-IDF; writes Prisma Question / CorpusEntry."""

import os
from typing import Annotated

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from agent.app.rag_pipeline import handle_ask, handle_bank

load_dotenv()


def _check_agent_key(x_agent_key: str | None) -> None:
    secret = os.environ.get("AGENT_RAG_SECRET", "").strip()
    if secret and (not x_agent_key or x_agent_key != secret):
        raise HTTPException(status_code=401, detail="Invalid or missing X-Agent-Key")


app = FastAPI(title="MCPServer RAG Agent", version="1")


@app.get("/health")
def health() -> dict:
    return {"ok": True, "role": "rag-agent"}


class AskBody(BaseModel):
    question: str = Field(..., min_length=3)
    refresh: bool = False


@app.post("/v1/rag/ask")
def rag_ask(
    body: AskBody,
    x_agent_key: Annotated[str | None, Header(alias="X-Agent-Key")] = None,
) -> dict:
    _check_agent_key(x_agent_key)
    try:
        return handle_ask(body.question, body.refresh)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


class BankBody(BaseModel):
    slug: str = Field(..., min_length=3)
    refresh: bool = False


@app.post("/v1/rag/bank")
def rag_bank(
    body: BankBody,
    x_agent_key: Annotated[str | None, Header(alias="X-Agent-Key")] = None,
) -> dict:
    _check_agent_key(x_agent_key)
    try:
        return handle_bank(body.slug, body.refresh)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
