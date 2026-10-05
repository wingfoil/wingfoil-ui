/**
 * The hand-written Memory schema of the `unknown` fixture: types no WingFoil template declares
 * (`02_bdd/00_conventions.md` *Fixtures*).
 */

/** `.wingfoil/memory.yaml` of the unknown fixture. */
export const UNKNOWN_MEMORY_YAML = `version: 1

types:
  story:
    path: docs/stories/{id}.md
    id_pattern: "story-{n}-{slug}"
    template:
      file: memory/templates/story.md
      frontmatter:
        required: [id, type, title, status]
    states:
      sequence: [ idea, shaping, ready-to-build, shipped ]
      gates:
        shaping: { reject: idea }
      waiting: [ ready-to-build ]
  note:
    path: docs/notes/{id}.md
    id_pattern: "note-{n}-{slug}"
    template:
      file: memory/templates/note.md
      frontmatter:
        required: [id, type, title, status]
    states:
      sequence: [ open, archived ]
`;

/** Templates referenced by {@link UNKNOWN_MEMORY_YAML}, by file name. */
export const UNKNOWN_TEMPLATES: Readonly<Record<string, string>> = {
  'story.md': '---\nid: ""\ntype: story\ntitle: ""\nstatus: idea\n---\n\n## Story\n',
  'note.md': '---\nid: ""\ntype: note\ntitle: ""\nstatus: open\n---\n\n## Note\n',
};
