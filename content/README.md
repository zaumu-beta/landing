# Resources content

Each Markdown file here becomes a page at `/resources/<filename>.html`, and
`/resources.html` lists them all. Two folders, two content types:

- `insights/` — Creator insights: rates, rights, negotiation, the creator business.
- `guides/`   — Platform guides: step-by-step how-tos (profile, campaigns, milestones, eTIMS).

## Adding an article

1. Create `insights/my-article.md` or `guides/my-guide.md`. The filename is the URL slug — lowercase, hyphens.
2. Start the file with front-matter:

   ```
   ---
   title: Know your usage rights before you sign anything
   description: One sentence for the card and search preview.
   date: 2026-04-20
   author: Zaumu Team        (optional)
   readTime: 4               (optional — estimated from word count if left out)
   featured: true            (optional — pins it as the large card at the top of the hub)
   tags: usage rights, rates (optional — comma-separated, searchable)
   ---
   ```

3. Write the body in Markdown. `##` headings become the "On this page" list;
   numbered lists render as lime step badges; `>` blockquotes render as callouts.
   Link to other articles with `/resources/<slug>.html`.
4. Run `npm run dev` (or `npm run build`) — the pages regenerate automatically.

Titles that contain a colon need quotes: `title: "Getting started: set up your profile"`.
