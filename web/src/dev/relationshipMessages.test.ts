import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RELATIONSHIP_MESSAGES, fillRelationshipMessage } from "./relationshipMessages";

describe("relationship messages", () => {
  it("fills the customer name and the editor", () => {
    assert.equal(fillRelationshipMessage("Hi {name}, enjoy the {editor}!", "  Ada   Lovelace "), "Hi Ada Lovelace, enjoy the RC-600 Editor!");
  });

  it("greets without a name", () => {
    assert.equal(fillRelationshipMessage("Hi {name}!", ""), "Hi there!");
  });

  it("has unique ids and no leftover placeholders", () => {
    const ids = new Set(RELATIONSHIP_MESSAGES.map((m) => m.id));
    assert.equal(ids.size, RELATIONSHIP_MESSAGES.length);
    for (const m of RELATIONSHIP_MESSAGES) assert.doesNotMatch(fillRelationshipMessage(m.text, "Ada"), /\{\w+\}/);
  });
});
