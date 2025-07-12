import {getMapText, spellFormSchema} from '../../src/utils/spell-form';
import type {Submission} from '../../src/utils/spell-compendium/spells';
import type {PagesFunction, Response as WorkerResponse} from '@cloudflare/workers-types'
import he from "he"
import {EmbedBuilder} from "@discordjs/builders"
import {glyphMap} from '../../src/utils/spell-compendium/data/glyphs';

interface Env {
    WEBHOOK_URL: string;
    ADMIN_WEBHOOK_URL: string;
}

const clean = (str: string) => he.encode(str, {useNamedReferences: true});

const getAddonText = getMapText(glyphMap)

export const onRequestPost: PagesFunction<Env> = async (context) => {
    const {request, env} = context;
    const form = await request.formData();

    const body = spellFormSchema.parse(form);
    const url = new URL(request.url)

    const submission: Submission = {
        name: clean(body.spell),
        category: body.category,
        author: clean(body.author),
        versions: body.versions,
        addons: body.addons || [],
        spells: [
            {
                glyphs: body.glyphs,
                description: clean(body.description),
                style: body.style ? JSON.parse(body.style) : {},
            }
        ]
    }

    const markdownBuilder: string[] = [];

    markdownBuilder.push("```json");
    markdownBuilder.push(JSON.stringify(submission) + ",");
    markdownBuilder.push("```");

    const embed = new EmbedBuilder()
        .setTitle(body.spell)
        .setDescription(body.description)
        .setFields([
            {name: "Category", value: body.category, inline: true},
            {name: "Versions", value: body.versions.join(", "), inline: true},
            {name: "Addons", value: body.addons && body.addons.length > 0 ? body.addons.join(", ") : "N/A"},
            {name: "Glyphs", value: body.glyphs.map(glyph => getAddonText(glyph)).join(" ➝ ")},
        ])
        .setAuthor({name: clean(body.author)});

    const adminRes = await fetch(env.ADMIN_WEBHOOK_URL, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username: "Source Librarian",
            avatar_url: "https://cdn.discordapp.com/avatars/1235017501419765800/ff05eb9f01601892dd7b083dad16798d.webp?size=4096",
            content: markdownBuilder.join("\n"),
            embeds: [embed.toJSON()]
        }),
    });

    if (!adminRes.ok) {
        const json = await adminRes.json();
        console.error("Discord Response", json);
    }

    return Response.redirect(url.origin, 303) as unknown as WorkerResponse;
}
