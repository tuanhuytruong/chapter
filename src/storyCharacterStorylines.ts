import type { StoryThreadRow } from "./types";

export type StoryCitation = { logId: string; session: number; pageStart: number; pageEnd: number };
export type CharacterTrajectory = { name: string; developments: Array<{ text: string; citation: StoryCitation }> };
export type CharacterRelationshipTimeline = { people: string[]; moments: Array<{ text: string; citation: StoryCitation }> };
export type CharacterStorylines = { characters: CharacterTrajectory[]; relationships: CharacterRelationshipTimeline[]; sessionsCovered: number; lastCitation: StoryCitation | null };

const normalize = (value: string) => value.toLocaleLowerCase().replace(/\s+/g, " ").trim();

/** Client-safe projection of persisted, spoiler-scoped Story Thread analyses. */
export function aggregateCharacterStorylines(rows: StoryThreadRow[]): CharacterStorylines {
  const characters = new Map<string, CharacterTrajectory>();
  const relationships = new Map<string, CharacterRelationshipTimeline>();
  let lastCitation: StoryCitation | null = null;
  for (const row of rows) {
    const citation = { logId: row.log_id, session: row.session, pageStart: row.page_start, pageEnd: row.page_end };
    lastCitation = citation;
    const arcs = row.analysis.characterArcs?.length
      ? row.analysis.characterArcs.map(({ name, development }) => ({ name, text: development }))
      : row.analysis.characterPulse.map(({ name, pulse }) => ({ name, text: pulse }));
    for (const arc of arcs) {
      const name = arc.name.trim(); const text = arc.text.trim();
      if (!name || !text || name === "Unnamed character") continue;
      const key = normalize(name);
      const character = characters.get(key) || { name, developments: [] };
      if (!character.developments.some((entry) => entry.text === text && entry.citation.logId === citation.logId)) character.developments.push({ text, citation });
      characters.set(key, character);
    }
    for (const relation of row.analysis.characterRelationships || []) {
      const people = relation.people.map((name) => name.trim()).filter(Boolean);
      const text = relation.detail.trim();
      if (people.length < 2 || !text) continue;
      const key = people.map(normalize).sort().join("|");
      const relationship = relationships.get(key) || { people, moments: [] };
      if (!relationship.moments.some((entry) => entry.text === text && entry.citation.logId === citation.logId)) relationship.moments.push({ text, citation });
      relationships.set(key, relationship);
    }
  }
  return { characters: [...characters.values()].sort((a, b) => a.name.localeCompare(b.name)), relationships: [...relationships.values()], sessionsCovered: rows.length, lastCitation };
}
