"""Prepare reviewed, grouped Nova conversation data. Never uploads or trains."""
import argparse
import hashlib
import json
from pathlib import Path


def prepare(records, minimum=2000):
    if len(records) < minimum:
        raise ValueError(f"At least {minimum} reviewed examples required; received {len(records)}")
    seen, groups = set(), {}
    for row in records:
        if row.get("reviewed") is not True or not row.get("reviewer") or not row.get("rights"):
            raise ValueError("Every example requires reviewer approval and rights")
        if row.get("source") not in ("editorial", "synthetic_reviewed"):
            raise ValueError("Personal conversations are not accepted by this pilot")
        if row.get("containsPersonalData") is not False:
            raise ValueError("Personal-data review is required")
        group = row.get("groupId")
        if not isinstance(group, str) or not group:
            raise ValueError("groupId must keep related conversations/templates together")
        messages = row.get("messages", [])
        if len(messages) < 2 or messages[0].get("role") != "user" or messages[-1].get("role") != "assistant":
            raise ValueError("Conversation must start with user and end with assistant")
        for i, message in enumerate(messages):
            if message.get("role") != ("user" if i % 2 == 0 else "assistant"):
                raise ValueError("Roles must alternate")
            if not isinstance(message.get("content"), list) or not message["content"]:
                raise ValueError("Nova content blocks are required")
            if any(not isinstance(block.get("text"), str) or not block["text"].strip() for block in message["content"]):
                raise ValueError("This pilot accepts text blocks only")
        sample = {"schemaVersion": "bedrock-conversation-2024", "system": [{"text": row.get("system", "Seyahat danışmanısın.")}], "messages": messages}
        digest = hashlib.sha256(json.dumps(sample, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        if digest in seen:
            raise ValueError("Duplicate conversation detected")
        seen.add(digest)
        groups.setdefault(group, []).append(sample)
    if len(groups) < 10:
        raise ValueError("At least ten independent groups required")
    ordered = sorted(groups, key=lambda g: hashlib.sha256(g.encode()).hexdigest())
    train_end, validation_end = int(len(ordered) * .8), int(len(ordered) * .9)
    parts = {"train": [], "validation": [], "test": []}
    for i, group in enumerate(ordered):
        parts["train" if i < train_end else "validation" if i < validation_end else "test"].extend(groups[group])
    return parts


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    records = [json.loads(line) for line in args.input.read_text().splitlines() if line.strip()]
    parts = prepare(records)
    args.output.mkdir(parents=True, exist_ok=False)
    manifest = {"schemaVersion": 1, "format": "bedrock-conversation-2024", "sourceSha256": hashlib.sha256(args.input.read_bytes()).hexdigest(), "splits": {}}
    for split, data in parts.items():
        file = args.output / f"{split}.jsonl"
        file.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in data) + "\n")
        manifest["splits"][split] = {"records": len(data), "sha256": hashlib.sha256(file.read_bytes()).hexdigest()}
    (args.output / "manifest.json").write_text(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
