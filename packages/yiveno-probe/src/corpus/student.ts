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
      suggestedClues: [
        'purdue owl apa formatting guide I bookmarked',
        'that citation page I noted for the lab report'
      ]
    },
    {
      key: 'openstax-bio-ch6',
      title: 'Biology 2e · Chapter 6: Metabolism',
      url: 'https://openstax.org/books/biology-2e/pages/6-introduction',
      daysAgo: 9,
      suggestedClues: [
        'openstax biology chapter on metabolism',
        'textbook chapter about metabolism I saved'
      ]
    },
    {
      key: 'khan-derivatives',
      title: 'Derivative as a concept',
      url: 'https://www.khanacademy.org/math/calculus-1/cs1-derivatives-definition-and-basic-rules/cs1-derivative-as-a-concept/a/derivative-as-a-concept',
      daysAgo: 4,
      note: 'midterm review',
      suggestedClues: [
        'khan academy page about derivative as a concept',
        'calculus bookmark I noted for midterm review'
      ]
    },
    {
      key: 'coursera-ml-week3',
      title: 'Supervised Machine Learning · Week 3',
      url: 'https://www.coursera.org/learn/machine-learning/home/week/3',
      daysAgo: 22,
      suggestedClues: [
        'coursera machine learning week 3 page',
        'that supervised learning course week I bookmarked'
      ]
    },
    {
      key: 'quizlet-orgo',
      title: 'Organic chemistry functional groups set',
      url: 'https://quizlet.com/yiveno-probe/organic-functional-groups',
      daysAgo: 11,
      suggestedClues: [
        'quizlet set on organic chemistry functional groups',
        'flashcards I saved for functional groups'
      ]
    },
    {
      key: 'campus-lib-ill',
      title: 'Interlibrary loan: how to request a chapter',
      url: 'https://library.example.edu/help/interlibrary-loan-chapter',
      daysAgo: 35,
      note: 'need chapter scan before Friday',
      suggestedClues: [
        'campus library page about interlibrary loan chapters',
        'bookmark where I noted need chapter scan before Friday'
      ]
    },
    {
      key: 'grammarly-thesis',
      title: 'How to write a thesis statement',
      url: 'https://www.grammarly.com/blog/thesis-statement/',
      daysAgo: 50,
      suggestedClues: [
        'grammarly article on thesis statements',
        'that how to write a thesis statement page'
      ]
    },
    {
      key: 'youtube-pomodoro',
      title: 'Pomodoro study blocks that actually stick',
      url: 'https://www.youtube.com/watch?v=yivenoStudentPomodoro01',
      daysAgo: 6,
      suggestedClues: [
        'youtube video about pomodoro study blocks',
        'study ritual video I bookmarked last week'
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
      suggestedClues: [
        'owl excerpt about including a DOI when available',
        'citation clip I annotated to fix refs before submit'
      ]
    },
    {
      key: 'ex-metabolism',
      pageTitle: 'Biology 2e · Chapter 6: Metabolism',
      sourceUrl: 'https://openstax.org/books/biology-2e/pages/6-introduction',
      selectedText:
        'Catabolic pathways release energy by breaking down complex molecules into simpler ones.',
      daysAgo: 8,
      suggestedClues: [
        'openstax excerpt about catabolic pathways releasing energy',
        'biology clip on breaking down complex molecules'
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
      suggestedClues: [
        'khan excerpt about derivative measuring how a function changes',
        'calculus clip I noted to explain without memorizing formula'
      ]
    },
    {
      key: 'ex-ml-week3',
      pageTitle: 'Supervised Machine Learning · Week 3',
      sourceUrl: 'https://www.coursera.org/learn/machine-learning/home/week/3',
      selectedText:
        'Regularization trades a little training loss for better generalization on unseen examples.',
      daysAgo: 21,
      suggestedClues: [
        'coursera excerpt about regularization and generalization',
        'ml week 3 clip on trading training loss'
      ]
    },
    {
      key: 'ex-pure-note-syllabus',
      pageTitle: 'Untitled document',
      sourceUrl: 'https://docs.google.com/document/d/yivenoStudentSyllabus01',
      selectedText: 'Week outline placeholder copied from the LMS.',
      daysAgo: 14,
      note: 'office hours Thu 2pm Room B12',
      suggestedClues: [
        'untitled doc where I noted office hours Thu 2pm',
        'syllabus scrap annotated about Room B12'
      ]
    }
  ]
}
