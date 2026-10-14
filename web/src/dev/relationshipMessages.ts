/** Ready-to-copy replies for customers on Facebook, Instagram, WhatsApp and similar. `{name}` and `{editor}` are filled in. */
export interface RelationshipMessage {
  id: string;
  title: string;
  text: string;
}

export const RELATIONSHIP_EDITOR = "RC-600 Editor";

export const RELATIONSHIP_MESSAGES: RelationshipMessage[] = [
  {
    id: "purchase-thanks",
    title: "Thanks for buying",
    text: "Hi {name}! Thank you so much for getting the {editor}. I hope it makes shaping your sounds faster and more fun. If anything doesn't work the way you expect, just message me here and I'll help. Enjoy!",
  },
  {
    id: "trial-thanks",
    title: "Thanks for trying",
    text: "Hi {name}! Thanks for trying the {editor}. I hope the trial gives you a good feel for it. When you're ready for the full version, just tell me and I'll send your key.",
  },
  {
    id: "feedback-thanks",
    title: "Thanks for the feedback",
    text: "Hi {name}, thank you for the feedback! Messages like yours are what keep the {editor} improving. I've noted it and will let you know when it's in an update.",
  },
];

export function fillRelationshipMessage(text: string, name: string, editor = RELATIONSHIP_EDITOR): string {
  const who = name.trim().replace(/\s+/g, " ") || "there";
  return text.split("{name}").join(who).split("{editor}").join(editor);
}
