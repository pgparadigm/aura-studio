/* Tools knowledge — Book II, Parts 19-34. Researched 2026-07-31.
 *
 * EVERYTHING IN THIS FILE IS DATED. Prices, plan names, model versions, ownership terms, licence
 * status and platform comparisons were true on one day and drift monthly. Every entry here sets
 * `volatile: true`, and Aura shows the date and tells the user to re-verify before money or rights
 * depend on it. That is not a disclaimer bolted on — it is the reason the entries are shaped this
 * way, around DECISIONS and TRAPS rather than around feature tables that rot.
 *
 * What Aura will not do with this knowledge:
 *   - no affiliate links, no referral codes, no ranking anyone paid for
 *   - no automatic uploads; Aura never sends audio anywhere
 *   - no recommending an artist-soundalike workflow for commercial release
 *   - no conflating Lalals.com with LALAL.AI; they are different companies
 *
 * Aura's own bias, stated openly: native over external, local over cloud, deterministic over
 * random, rights-clear over ambiguous, downloadable over locked in. Where an external tool is
 * genuinely the honest answer, Aura says so and says what should come back.
 */
(function (global) {
  'use strict';
  var K = global.AuraKnowledge;
  if (!K) return;
  var V = '2026-07-31';

  K.add('tools', [
    {
      id: 'router-layers',
      topic: 'Which layer does this task belong to?',
      triggers: [/what tool|which tool|should i use|recommend.*tool/,
                 /generator|platform|subscription|daw|workstation/],
      volatile: true, verified: V,
      beginner:
        'Tasks split into five layers, and naming the layer first stops you reaching for the wrong ' +
        'kind of tool: making a whole song from a prompt, changing or synthesising a voice, pulling ' +
        'a mix apart into stems, mixing and mastering, and assembling the record in a workstation. ' +
        'Aura is a writing and arranging room with a singer at the centre — it is not a full-song ' +
        'generator and does not pretend to be.',
      auraCan: [
        'Everything from a starting idea to an arranged, mixed, exported record with your voice on it.',
        'Aura tells you honestly when a task genuinely needs something else.',
      ],
      auraCannot: [
        'Aura does not generate a finished song with synthetic vocals from a text prompt.',
        'Aura does not separate an existing record into stems.',
      ],
      why: 'Naming the layer stops most wasted subscriptions.',
      source: 'Book II, Part 19',
    },
    {
      id: 'soundalike-trap',
      topic: 'Artist-soundalike voices are not releasable',
      triggers: [/sound like|soundalike|voice of|clone.*(artist|singer|celebrity)/,
                 /artist voice|famous voice|someone else.?s voice/],
      volatile: true, verified: V,
      beginner:
        'Platforms that offer named-artist voices generally split them into voices they own and ' +
        'artist-soundalikes. The soundalikes are personal and non-commercial in the terms, on every ' +
        'paid tier, however the marketing reads. Releasing one commercially also runs into ' +
        'right-of-publicity law in several US states and a misappropriation-of-personality tort in ' +
        'Canada. Your own cloned voice, or a properly licensed voice with a revenue share, is the ' +
        'clean route.',
      auraCan: [
        'Aura records and produces YOUR voice, which is yours to release.',
      ],
      auraCannot: [
        'Aura has no voice cloning and no voice conversion, and will not add artist soundalikes.',
      ],
      rights:
        'Aura does not give legal advice. This is the single most expensive misunderstanding in this ' +
        'area, so it is worth an entertainment lawyer before anything is released.',
      why: 'The marketing and the terms of service frequently contradict each other here.',
      source: 'Book II, Parts 20, 24 and 31',
    },
    {
      id: 'naming-trap',
      topic: 'Two similarly named companies, two different things',
      triggers: [/lalals|lalal\.ai|lalal/i],
      volatile: true, verified: V,
      beginner:
        'Lalals.com and LALAL.AI are different companies. One is an all-in-one AI music and voice ' +
        'platform; the other is a stem-separation specialist. Review sites conflate them constantly. ' +
        'Check which one you are actually buying before you subscribe.',
      auraCan: [],
      auraCannot: [],
      why: 'Most of the confusing advice about either one comes from mixing them up.',
      source: 'Book II, Part 19',
    },
    {
      id: 'platform-risk',
      topic: 'Download everything, immediately, always',
      triggers: [/platform risk|lock.?in|walled garden|lose.*(track|song|download)/,
                 /can.?t (download|export)/],
      volatile: true, verified: V,
      beginner:
        'One major platform settled with a rights holder and disabled every download overnight — ' +
        'audio, stems and video — including for people who had paid for exactly that. Assume any ' +
        'cloud platform can do the same. Never let the only copy of your work live inside someone ' +
        'else’s product.',
      auraCan: [
        'Aura runs on your machine and writes files to your disk. Nothing is held anywhere else.',
        'Export the complete project bundles everything Aura holds in one folder.',
      ],
      auraCannot: [],
      why: 'Paid features have been deleted retroactively with no notice. That is not hypothetical.',
      source: 'Book II, Part 22',
    },
    {
      id: 'human-authorship',
      topic: 'Human authorship is what makes it yours',
      triggers: [/copyright|\bown(ership|s|ed)?\b|can i (release|sell)|royalt/, /is it mine/],
      volatile: true, verified: V,
      beginner:
        'The position in the US is that purely prompt-generated material is not copyrightable, while ' +
        'the human contributions — your lyrics, your topline, your arrangement, your recorded ' +
        'performance — are. The practical move is to make sure there is substantial human authorship ' +
        'in anything you release, and to be able to show it.',
      auraCan: [
        'Everything Aura makes, you edited. Rights & Sources records what came from where.',
        'Your recorded vocal is yours, and Aura never sends it anywhere.',
      ],
      auraCannot: [],
      rights:
        'Aura does not give legal advice and cannot tell you that you own anything. It tells you what ' +
        'went into the project so you can answer that question properly.',
      why: 'Documenting authorship is cheap now and expensive to reconstruct later.',
      source: 'Book II, Part 31',
    },
    {
      id: 'determinism-gap',
      topic: 'Nobody else offers reproducible generation',
      triggers: [/seed|reproduc|same result|deterministic|idea code/, /random|different every time/],
      volatile: true, verified: V,
      beginner:
        'Across the generation platforms, the same prompt gives a different song every time — there ' +
        'is no seed you can keep, and no way to get an idea back once it scrolls away. It is the ' +
        'most requested missing feature in the whole category.',
      auraCan: [
        'Aura owns its synthesis, so every generated idea carries an Idea Code.',
        'The same Idea Code and a compatible project reproduce the same musical result.',
        'Make a close variation, make a bold variation, or go back to the previous idea.',
      ],
      auraCannot: [],
      why: 'Reproducibility is the difference between a slot machine and an instrument.',
      source: 'Book II, Part 30',
    },
    {
      id: 'export-bundle-gap',
      topic: 'The one-click full export nobody ships',
      triggers: [/export.*(everything|bundle|complete|stems and midi)/, /full project|hand off|send to/],
      volatile: true, verified: V,
      beginner:
        'The bundle everyone wants — stems, MIDI, a tempo and key map, the lyrics, and a session ' +
        'file, in one click — is not shipped whole by any of the generation platforms. A couple get ' +
        'partway.',
      auraCan: [
        'Export the complete project writes the project file, a master WAV, MIDI for the melody ' +
        'and harmony, a tempo, key and section map, lyrics, performance automation, the ' +
        'variation list, a Rights & Sources manifest and a README. There are no separate part ' +
        'WAVs, and the MIDI carries no drum or bass track.',
      ],
      auraCannot: [],
      why: 'A record you cannot get out of the tool is a record you do not own in practice.',
      source: 'Book II, Part 30',
    },
    {
      id: 'stems-routing',
      topic: 'Splitting an existing record into stems',
      triggers: [/stem|separat|acapella|isolate|remove vocal|instrumental from/],
      volatile: true, verified: V,
      beginner:
        'This is a real need and Aura genuinely cannot do it. The current state of the art is a ' +
        'family of transformer separators, available through several web tools, a well-known free ' +
        'local application, and increasingly built into the major workstations — one of which won a ' +
        '2026 comparison outright. Prefer a local tool: your audio stays on your machine.',
      auraCan: [
        'Aura reconstructs an editable arrangement from what it hears in a reference, which is a ' +
        'different thing from separating it, and it says so plainly.',
      ],
      auraCannot: [
        'Aura does not separate audio into stems, and ships no separation model.',
      ],
      rights:
        'Separating a commercial record is fine for private study. Releasing anything built on the ' +
        'result is a different question entirely.',
      why: 'No licence-clean separation model exists that Aura could ship — the weights, the datasets ' +
           'and in one case an active patent all block it.',
      source: 'Book II, Part 25',
    },
    {
      id: 'mastering-routing',
      topic: 'Mastering, and when it is worth paying for',
      triggers: [/master(ing)?|loud(ness)?|lufs|ready for spotify|final polish/],
      volatile: true, verified: V,
      beginner:
        'Automatic mastering is good enough for a streaming single and is available inside several ' +
        'workstations and as standalone services. For an album, where the point is cohesion across ' +
        'tracks, a human still wins. Aura exports at full quality, so you can master elsewhere ' +
        'without losing anything.',
      auraCan: [
        'Aura exports a peak-safe master WAV and the individual part WAVs.',
        'Mix Check catches the problems that make a master sound bad before you get there.',
      ],
      auraCannot: [
        'Aura has no mastering chain and does not claim one.',
      ],
      why: 'Most mastering problems are mix problems that were not caught.',
      source: 'Book II, Part 26',
    },
    {
      id: 'distribution-policy',
      topic: 'Check your distributor the week you release',
      triggers: [/distribut|spotify|tunecore|distrokid|tidal|upload.*(store|dsp)/, /release it/],
      volatile: true, verified: V,
      beginner:
        'Distributors and streaming services are actively diverging on AI-assisted music: some block ' +
        'certain platforms’ output, one stopped paying royalties on fully-AI tracks, another is ' +
        'piloting disclosure credits. Detection is effectively solved, so assume they can tell. ' +
        'Human-performed elements change that calculation. Check the policy the week you release, ' +
        'not the month before.',
      auraCan: [
        'Rights & Sources gives you an accurate account of what is in the record before you send it.',
      ],
      auraCannot: [],
      rights: 'Policies here change faster than almost anything else in this document.',
      why: 'This is the single most time-sensitive area in the whole tools layer.',
      source: 'Book II, Part 31',
    },
  ]);
})(window);
