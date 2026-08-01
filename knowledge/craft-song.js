/* Craft knowledge — song architecture, transitions, melody, sound choice and emotional shape.
 * Book I, Parts 5, 8, 9, 10, 13, 16.
 */
(function (global) {
  'use strict';
  var K = global.AuraKnowledge;
  if (!K) return;

  K.add('song', [
    {
      id: 'hook-first',
      topic: 'Build the hook first, then take things away',
      triggers: [/where.*(start|begin)/, /hook first|chorus first/, /verse.*(from|out of).*chorus/,
                 /build.*song|full song|complete song/],
      beginner:
        'Build the fullest version first — the chorus — then make the verse by muting things. It is ' +
        'far easier than building a verse and hoping a chorus appears. The verse is the chorus with ' +
        'elements stripped out; the chorus is the verse with everything back plus one more.',
      auraCan: [
        'Song Architect builds the full arrangement and derives the sparser sections from it.',
        'Make the verse simpler removes parts rather than rewriting them.',
      ],
      auraCannot: [],
      why: 'Subtraction is a reliable way to get contrast. Addition rarely is.',
      source: 'Book I, Part 9',
    },
    {
      id: 'default-form',
      topic: 'The default shape of the song',
      triggers: [/structure|arrangement|form|sections/, /how long.*song|song length/],
      beginner:
        'Intro, verse, pre-chorus, chorus, verse, pre-chorus, chorus, bridge, final chorus, outro. ' +
        'It is a starting point, not a rule — but it is the shape most of this music takes, and ' +
        'departing from it deliberately works better than never having had it.',
      auraCan: [
        'Song Architect lays this out and every section stays editable.',
        'Add a pre-chorus, add a bridge, add a breather, or make it shorter.',
      ],
      auraCannot: [],
      why: 'A known shape frees you to spend attention on the parts that carry feeling.',
      source: 'Book I, Part 9 and Part 18',
    },
    {
      id: 'transitions-not-cuts',
      topic: 'Never hard-cut between sections',
      triggers: [/transition|between sections|hard cut|jump/, /fill|breather|sweep/],
      beginner:
        'The clearest sign of an unfinished record is sections that just stop and start. Real ' +
        'transitions are small: drop an element for a bar, let a reverb tail run over the join, ' +
        'sweep a filter across two bars, put one drum fill in, or leave a beat of near-silence.',
      auraCan: [
        'Transition Designer creates real editable events at any section join.',
        'It recommends by what is leaving and what is arriving, not at random.',
      ],
      auraCannot: [],
      why: 'The join is where an arrangement either reads as a song or as a loop with edits.',
      source: 'Book I, Part 9',
    },
    {
      id: 'outro-return',
      topic: 'End where you began, but changed',
      triggers: [/outro|ending|end the song|resolve/],
      beginner:
        'Bring back the first thing the listener heard, but not identically — add the hook part over ' +
        'it, or drop one layer an octave, and filter everything down as it goes. It reads as a ' +
        'journey ending where it started rather than a track running out.',
      auraCan: [
        'Resolve the outro reuses the opening material with a filter close.',
      ],
      auraCannot: [],
      why: 'Repetition with change is what makes an ending feel earned.',
      source: 'Book I, Part 9',
    },
    {
      id: 'find-the-sound-first',
      topic: 'Find the sound before you write the part',
      triggers: [/what sound|which sound|find a sound|preset/, /melody.*(start|write|idea)/,
                 /warm|dark|glassy|vintage|dreamy|wide/],
      beginner:
        'The right sound suggests the part. The wrong one makes you write around it and then stack ' +
        'layers to compensate. Spend the first ten minutes on the sound, not the notes — a simple ' +
        'line through the right voice beats a clever one through the wrong voice every time.',
      auraCan: [
        'Find a sound explores families by feel — warm, dark, glassy, wide, intimate.',
        'Once you keep a sound, melody suggestions follow its register and articulation.',
      ],
      auraCannot: [],
      why: 'Sound choice is a writing decision, not a mixing one.',
      source: 'Book I, Part 5 and Part 13',
    },
    {
      id: 'record-loose-quantize-after',
      topic: 'Play it loose, tidy it after',
      triggers: [/quantize|timing|off.?grid|sloppy|stiff/, /record.*(melody|idea)/],
      beginner:
        'Hit record before you have it worked out and play it several times. Tidy the timing after. ' +
        'Tighten the low parts hard — sloppiness down there reads as a mistake — and leave the high ' +
        'parts looser, because that is where the human feel lives.',
      auraCan: [
        'Aura quantises what it reconstructs and shows you how far each hit moved.',
        'Melody notes stay editable and snap to your key if you want them to.',
      ],
      auraCannot: [
        'Aura does not record a live MIDI performance from a keyboard; it writes parts you edit.',
      ],
      why: 'Perfectly gridded parts usually feel stiff anyway.',
      source: 'Book I, Part 13',
    },
    {
      id: 'mix-as-you-go',
      topic: 'Mix while you write, not after',
      triggers: [/mix|balance|eq|compress|when.*mix/, /sounds? (bad|muddy|thin|harsh)/],
      beginner:
        'Shape each sound as you place it rather than saving it all for a mixing phase. The record ' +
        'should sound close to finished by the time the writing is done. Waiting means fixing ' +
        'decisions instead of making them.',
      auraCan: [
        'Mix Check reads the actual project and tells you what is colliding, in plain words.',
        'Its named fixes are real controls: Bass Breath, Space, Vintage and Heat in Groove, and the\n         levels, Pan and EQ on each channel in Balance.',
      ],
      auraCannot: [],
      why: 'A separate mixing phase is where momentum goes to die.',
      source: 'Book I, Part 8 and Part 13',
    },
    {
      id: 'reward-density',
      topic: 'Every section change should pay the listener something',
      triggers: [/boring|flat|nothing happens|same throughout/, /contrast|dynamic|energy/,
                 /emotion|feel(ing)?/],
      beginner:
        'Give each change a small reward — a part entering, a filter opening, a fill landing, a ' +
        'vocal layer arriving. And hold something back: if the first chorus already gives everything, ' +
        'the last one has nothing left to give.',
      auraCan: [
        'Emotion Map measures energy, density and contrast per section and finds the flat stretches.',
        'Create a final lift makes the last chorus peak, and the octave rise transition acts on real parts.',
      ],
      auraCannot: [
        'Aura measures musical structure. It does not measure how a listener will feel.',
      ],
      why: 'Attention is paid for in small rewards.',
      source: 'Book I, Part 16',
    },
    {
      id: 'space-to-hear',
      topic: 'Leave space or nothing lands',
      triggers: [/\bspace\b|\broom\b|crowded|dense|everything at once/, /vocal.*(space|room|compet)/],
      beginner:
        'When everything is dense at once the ear cannot lock onto any single thread, and the song ' +
        'stops landing. The gap between the bass and the snare, the breather before the hook, the ' +
        'room left for a voice — those are not absences, they are what makes the rest audible.',
      auraCan: [
        'Mix Check warns when a section is too dense or when the vocal has no room.',
        'Leave more room for vocals thins the parts that sit in the voice’s range.',
      ],
      auraCannot: [],
      why: 'You are not competing for loudness. You are competing for attention.',
      source: 'Book I, Part 16',
    },
    {
      id: 'delivery-over-polish',
      topic: 'A real take beats a correct one',
      triggers: [/take|performance|delivery|emotion|conviction/, /perfect|imperfect|good enough/],
      beginner:
        'A roughly written line delivered with conviction moves people. A perfect line delivered ' +
        'without it does not. When something feels real but is not technically perfect, keep the real ' +
        'one — that is the whole reason anyone listens twice.',
      auraCan: [
        'Vocal Coach gives phrasing and breath cues without touching your take.',
        'Aura keeps takes and lets you compare, rather than deciding for you.',
      ],
      auraCannot: [],
      why: 'Authentic expression over technical perfection.',
      source: 'Book I, Part 16 and Part 18',
    },
  ]);
})(window);
