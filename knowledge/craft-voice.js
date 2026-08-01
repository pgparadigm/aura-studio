/* Craft knowledge — lyrics, topline, bilingual writing and vocal delivery. Book I, Part 15 and 17.
 *
 * This is coaching knowledge, not a language model. Aura analyses text the user wrote: it counts
 * syllables, finds stress against the grid, flags consonant clusters on held notes. It does not
 * write lyrics, and nothing here should let it pretend otherwise.
 */
(function (global) {
  'use strict';
  var K = global.AuraKnowledge;
  if (!K) return;

  K.add('lyrics', [
    {
      id: 'syllables-fit-melody',
      topic: 'Syllables have to fit the melody',
      triggers: [/syllab/, /fit.*(melody|line|lyric)|lyric.*fit/, /too many words|cram|rush/],
      beginner:
        'More syllables than the melody has room for forces the delivery, and a forced delivery is ' +
        'audible before the words are. Count them against the notes and cut, or open the melody up.',
      auraCan: [
        'Lyric Studio counts syllables per line and compares them to the melody notes in that section.',
        'Fit this to the melody shows exactly where a line runs past the notes available.',
      ],
      auraCannot: [
        'Aura does not rewrite your line for you. It shows you where it does not fit.',
      ],
      why: 'A line that scans on the page can still be unsingable.',
      source: 'Book I, Part 15',
    },
    {
      id: 'stress-on-strong-beats',
      topic: 'Stressed syllables belong on strong beats',
      triggers: [/stress|emphasis|accent.*(word|syllab)/, /awkward|clunky|doesn.?t sit/],
      beginner:
        'Where the word naturally stresses should line up with where the music is strong. When they ' +
        'fight, the listener hears the seam even if they cannot name it.',
      auraCan: [
        'Lyric Studio counts syllables against the notes actually in that section, in English, Spanish or a mix.',
      ],
      auraCannot: [
        'Aura reads stress from spelling and length. It cannot hear how you will actually sing it.',
      ],
      why: 'Prosody is the difference between a lyric and a lyric that sings.',
      source: 'Book I, Part 15',
    },
    {
      id: 'vowels-and-consonants',
      topic: 'Open vowels hold; consonant clusters do not',
      triggers: [/vowel|consonant|hold.*(note|vowel)|sustain.*(note|word)/, /hard to sing|can.?t hold/],
      beginner:
        'Open vowels — ah, oh — carry power notes. Closed ones sit intimate. You cannot sustain on a ' +
        'consonant cluster, so a long note landing on one will always feel wrong. Plosives on snare ' +
        'hits, though, give the line rhythmic punch.',
      auraCan: [
        'Lyric Studio flags long notes whose syllable ends in a cluster, and finds the open vowels.',
      ],
      auraCannot: [],
      why: 'How words feel in the mouth when sung, not how they read on a page.',
      source: 'Book I, Part 15 and Part 17',
    },
    {
      id: 'bilingual-defaults',
      topic: 'Spanish for the feeling, English for the hook',
      triggers: [/spanish|english|spanglish|bilingual|both languages/, /translat/],
      beginner:
        'A common and effective default: the emotional core in Spanish, the quotable hook line in ' +
        'English — or the reverse, deliberately. Single words from the other language work as ' +
        'texture and anchoring either way.',
      auraCan: [
        'Lyric Studio handles English, Spanish and mixed lines, and counts syllables for each.',
      ],
      auraCannot: [
        'Aura does not translate. Translation that keeps the singability is a human judgement.',
      ],
      why: 'A word that sings beats a word that is literally correct.',
      source: 'Book I, Part 15',
    },
    {
      id: 'forced-rhyme',
      topic: 'A forced rhyme is a line you would not say',
      triggers: [/rhyme|forced|unnatural|corny/, /conversational|natural/],
      beginner:
        'If you would not say it in conversation, it will not survive being sung. Rhyme that bends ' +
        'the sentence to reach the sound is the most common thing that makes a lyric read as amateur.',
      auraCan: [
        'Find forced lines flags inversions and padding words that usually mark a bent line.',
        'Rhyme grouping shows which line endings you have actually committed to.',
      ],
      auraCannot: [
        'Aura cannot judge whether a line is good. It can show you where the strain is.',
      ],
      why: 'Concrete and specific beats abstract and general, every time.',
      source: 'Book I, Part 15',
    },
    {
      id: 'breath-marks',
      topic: 'Mark the breaths before you record',
      triggers: [/breath|breathe|run out of air|phrase/, /record.*(vocal|take)/],
      beginner:
        'Decide where you breathe before the take, not during it. A breath taken in the wrong place ' +
        'breaks a phrase; one planned into a gap disappears.',
      auraCan: [
        'Mark breaths places breath points at the gaps in the melody and lets you move them.',
        'Vocal Coach cues them during the count-in.',
      ],
      auraCannot: [],
      why: 'Running out of air is a planning problem, not a technique problem.',
      source: 'Book I, Part 15',
    },
    {
      id: 'coaching-cues',
      topic: 'Short cues work; long notes do not',
      triggers: [/coach|cue|direction|how.*(sing|deliver)/, /booth|take.*direction/],
      beginner:
        'In the moment you can hold one instruction. Breathe before this phrase. Lean into that ' +
        'consonant. Pull back on the second line. Keep the verse closer than the chorus. Anything ' +
        'longer than a sentence is a note for afterwards.',
      auraCan: [
        'Vocal Coach shows one cue at a time, drawn from your key, melody and section.',
      ],
      auraCannot: [
        'Aura does not listen to your voice or judge your pitch.',
        'Aura gives no health or medical advice about your voice, ever.',
      ],
      why: 'Direction competes with performance for attention. Keep it cheap.',
      source: 'Book I, Part 15',
    },
    {
      id: 'quiet-versus-power',
      topic: 'Keep the verse closer than the chorus',
      triggers: [/verse.*chorus.*(same|similar)|dynamic.*vocal/, /quiet|intimate|power|belt/],
      beginner:
        'If the verse is sung as hard as the chorus there is nowhere to go. Sing the verse closer and ' +
        'quieter, then let the chorus open. The contrast does more than volume ever will.',
      auraCan: [
        'Vocal Coach suggests a contrast plan per section from your arrangement.',
        'Emotion Map flags a verse and chorus that measure too alike.',
      ],
      auraCannot: [],
      why: 'Dynamics in the performance matter more than dynamics in the mix.',
      source: 'Book I, Part 15 and Part 16',
    },
    {
      id: 'range-check',
      topic: 'Know where the melody sits before you sing it',
      triggers: [/range|too high|too low|octave.*(down|up)|comfortable/],
      beginner:
        'Check the highest and lowest notes before the take. If the peak sits above where you are ' +
        'comfortable, move the whole melody down an octave or change the key — it is a two-second ' +
        'decision that saves an hour of straining.',
      auraCan: [
        'Vocal Coach reports the melody’s range in your project and the notes at the extremes.',
        'Vocal Coach reads your key, tempo, range and arrangement and gives one cue at a time.',
      ],
      auraCannot: [
        'Aura does not know your voice. It reports the music’s range, not your capability.',
      ],
      why: 'The take gets better when the notes are reachable.',
      source: 'Book I, Part 15',
    },
  ]);
})(window);
