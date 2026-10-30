import { Fragment } from "react";
import { inlineParts, messageBlocks } from "../lib/ai/message-format";

function Inline({ text }: { text: string }) {
  return inlineParts(text).map((part, i) =>
    part.kind === "strong" ? (
      <strong key={i}>{part.text}</strong>
    ) : part.kind === "code" ? (
      <code key={i}>{part.text}</code>
    ) : part.kind === "link" ? (
      <a key={i} href={part.href} target="_blank" rel="noopener noreferrer">
        {part.text}
      </a>
    ) : (
      <Fragment key={i}>{part.text}</Fragment>
    ),
  );
}
export function AssistantMessage({ text }: { text: string }) {
  return (
    <div className="ai-answer-text">
      {messageBlocks(text).map((block, i) => {
        if (block.kind === "heading")
          return (
            <h3 key={i}>
              <Inline text={block.lines[0]} />
            </h3>
          );
        if (block.kind === "list") {
          const items = block.lines.map((line, j) => (
            <li key={j}>
              <Inline text={line} />
            </li>
          ));
          return block.ordered ? <ol key={i}>{items}</ol> : <ul key={i}>{items}</ul>;
        }
        return (
          <p key={i}>
            {block.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                <Inline text={line} />
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
