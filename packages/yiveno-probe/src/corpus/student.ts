/**
 * DEV 召回探针语料 · 学生 / 终身学习者画像（扩展覆盖；默认种库不含）。
 * 题材：课程页、教材、引用规范、抽认卡、校园指南；偏摘录+附注。
 */

import type { RecallProbePersonaCorpus } from './types'

export const STUDENT_PROBE_CORPUS: RecallProbePersonaCorpus = {
  persona: 'student',
  label: 'Student / lifelong learner',
  bookmarks: [
    {
      key: 'owl-apa',
      title: 'APA Formatting and Style Guide',
      url: 'https://owl.purdue.edu/owl/research_and_citation/apa_style/apa_formatting_and_style_guide/index.html',
      daysAgo: 18,
      note: 'cite lab report week 4',
      clues: [
        { text: 'purdue owl apa formatting guide I bookmarked', type: 'verbatim' },
        { text: 'that citation page I noted for the lab report', type: 'note' }
      ]
    },
    {
      key: 'openstax-bio-ch6',
      title: 'Biology 2e · Chapter 6: Metabolism',
      url: 'https://openstax.org/books/biology-2e/pages/6-introduction',
      daysAgo: 9,
      clues: [
        { text: 'openstax biology chapter on metabolism', type: 'verbatim' },
        { text: 'textbook chapter about metabolism I saved', type: 'verbatim' }
      ]
    },
    {
      key: 'khan-derivatives',
      title: 'Derivative as a concept',
      url: 'https://www.khanacademy.org/math/calculus-1/cs1-derivatives-definition-and-basic-rules/cs1-derivative-as-a-concept/a/derivative-as-a-concept',
      daysAgo: 4,
      note: 'midterm review',
      clues: [
        { text: 'khan academy page about derivative as a concept', type: 'verbatim' },
        { text: 'calculus bookmark I noted for midterm review', type: 'note' }
      ]
    },
    {
      key: 'coursera-ml-week3',
      title: 'Supervised Machine Learning · Week 3',
      url: 'https://www.coursera.org/learn/machine-learning/home/week/3',
      daysAgo: 22,
      clues: [
        { text: 'coursera machine learning week 3 page', type: 'verbatim' },
        { text: 'that supervised learning course week I bookmarked', type: 'verbatim' }
      ]
    },
    {
      key: 'quizlet-orgo',
      title: 'Organic chemistry functional groups set',
      url: 'https://quizlet.com/yiveno-probe/organic-functional-groups',
      daysAgo: 11,
      clues: [
        { text: 'quizlet set on organic chemistry functional groups', type: 'verbatim' },
        { text: 'flashcards I saved for functional groups', type: 'verbatim' }
      ]
    },
    {
      key: 'campus-lib-ill',
      title: 'Interlibrary loan: how to request a chapter',
      url: 'https://library.example.edu/help/interlibrary-loan-chapter',
      daysAgo: 35,
      note: 'need chapter scan before Friday',
      clues: [
        { text: 'campus library page about interlibrary loan chapters', type: 'verbatim' },
        { text: 'bookmark where I noted need chapter scan before Friday', type: 'note' }
      ]
    },
    {
      key: 'grammarly-thesis',
      title: 'How to write a thesis statement',
      url: 'https://www.grammarly.com/blog/thesis-statement/',
      daysAgo: 50,
      clues: [
        { text: 'grammarly article on thesis statements', type: 'verbatim' },
        { text: 'that how to write a thesis statement page', type: 'verbatim' }
      ]
    },
    {
      key: 'youtube-pomodoro',
      title: 'Pomodoro study blocks that actually stick',
      url: 'https://www.youtube.com/watch?v=yivenoStudentPomodoro01',
      daysAgo: 6,
      clues: [
        { text: 'youtube video about pomodoro study blocks', type: 'verbatim' },
        { text: 'study ritual video I bookmarked last week', type: 'temporal' }
      ]
    }
  ],
  excerpts: [
    {
      key: 'ex-owl-apa',
      pageTitle: 'APA Formatting and Style Guide',
      sourceUrl:
        'https://owl.purdue.edu/owl/research_and_citation/apa_style/apa_formatting_and_style_guide/index.html',
      selectedText:
        'Include a DOI when available; otherwise provide a stable URL that still resolves for readers.',
      daysAgo: 17,
      note: 'fix refs before submit',
      clues: [
        { text: 'owl excerpt about including a DOI when available', type: 'paraphrase' },
        { text: 'citation clip I annotated to fix refs before submit', type: 'note' }
      ]
    },
    {
      key: 'ex-metabolism',
      pageTitle: 'Biology 2e · Chapter 6: Metabolism',
      sourceUrl: 'https://openstax.org/books/biology-2e/pages/6-introduction',
      selectedText:
        'Catabolic pathways release energy by breaking down complex molecules into simpler ones.',
      daysAgo: 8,
      clues: [
        { text: 'openstax excerpt about catabolic pathways releasing energy', type: 'paraphrase' },
        { text: 'biology clip on breaking down complex molecules', type: 'verbatim' }
      ]
    },
    {
      key: 'ex-derivative',
      pageTitle: 'Derivative as a concept',
      sourceUrl:
        'https://www.khanacademy.org/math/calculus-1/cs1-derivatives-definition-and-basic-rules/cs1-derivative-as-a-concept/a/derivative-as-a-concept',
      selectedText:
        'The derivative measures how a function changes as its input changes, not just the slope of one chord.',
      daysAgo: 3,
      note: 'explain without memorizing formula',
      clues: [
        {
          text: 'khan excerpt about derivative measuring how a function changes',
          type: 'verbatim'
        },
        { text: 'calculus clip I noted to explain without memorizing formula', type: 'note' }
      ]
    },
    {
      key: 'ex-ml-week3',
      pageTitle: 'Supervised Machine Learning · Week 3',
      sourceUrl: 'https://www.coursera.org/learn/machine-learning/home/week/3',
      selectedText:
        'Regularization trades a little training loss for better generalization on unseen examples.',
      daysAgo: 21,
      clues: [
        { text: 'coursera excerpt about regularization and generalization', type: 'paraphrase' },
        { text: 'ml week 3 clip on trading training loss', type: 'verbatim' }
      ]
    },
    {
      key: 'ex-pure-note-syllabus',
      pageTitle: 'Untitled document',
      sourceUrl: 'https://docs.google.com/document/d/yivenoStudentSyllabus01',
      selectedText: 'Week outline placeholder copied from the LMS.',
      daysAgo: 14,
      note: 'office hours Thu 2pm Room B12',
      clues: [
        { text: 'untitled doc where I noted office hours Thu 2pm', type: 'note' },
        { text: 'syllabus scrap annotated about Room B12', type: 'note' }
      ]
    }
  ]
}
