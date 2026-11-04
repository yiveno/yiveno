/**
 * DEV 召回探针语料 · 知识工作者 / 非工程职场画像（扩展覆盖；默认种库不含）。
 * 题材：政策 wiki、会议纪要、费用报销、项目简报、协作工具帮助页；少代码文档。
 */

import type { RecallProbePersonaCorpus } from './types'

export const KNOWLEDGE_WORKER_PROBE_CORPUS: RecallProbePersonaCorpus = {
  persona: 'knowledge_worker',
  label: 'Knowledge worker / office ops',
  bookmarks: [
    {
      key: 'notion-expense',
      title: 'Expense policy · meals and travel',
      url: 'https://www.notion.so/yiveno-probe/Expense-policy-meals-travel',
      daysAgo: 28,
      note: 'receipts before month end',
      clues: [
        { text: 'notion page about expense policy for meals and travel', type: 'verbatim' },
        { text: 'wiki I annotated about receipts before month end', type: 'note' }
      ]
    },
    {
      key: 'gdoc-qbr',
      title: 'QBR talking points — North America',
      url: 'https://docs.google.com/document/d/yivenoProbeQbrNa01',
      daysAgo: 12,
      clues: [
        { text: 'google doc with qbr talking points for north america', type: 'verbatim' },
        { text: 'that quarterly business review talking points doc', type: 'verbatim' }
      ]
    },
    {
      key: 'slack-status',
      title: 'How to set a status and pause notifications',
      url: 'https://slack.com/help/articles/201864558-Set-your-status-and-availability',
      daysAgo: 5,
      note: 'focus Friday ritual',
      clues: [
        { text: 'slack help on setting status and pausing notifications', type: 'verbatim' },
        { text: 'bookmark I noted for focus Friday ritual', type: 'note' }
      ]
    },
    {
      key: 'asana-brief',
      title: 'Project brief: Vendor onboarding refresh',
      url: 'https://app.asana.com/0/yiveno-probe/vendor-onboarding-refresh',
      daysAgo: 19,
      clues: [
        { text: 'asana project brief about vendor onboarding refresh', type: 'verbatim' },
        { text: 'that vendor onboarding project page I saved', type: 'verbatim' }
      ]
    },
    {
      key: 'hr-pto',
      title: 'PTO request windows and blackout dates',
      url: 'https://hr.example.com/handbook/pto-blackout-dates',
      daysAgo: 40,
      note: 'check before booking flights',
      clues: [
        { text: 'hr handbook page on pto blackout dates', type: 'verbatim' },
        { text: 'pto policy bookmark I noted before booking flights', type: 'note' }
      ]
    },
    {
      key: 'zoom-recording',
      title: 'Cloud recording retention and who can download',
      url: 'https://support.zoom.com/hc/en/article?id=zm_kb_yiveno_probe_recording',
      daysAgo: 8,
      clues: [
        { text: 'zoom support article about cloud recording retention', type: 'verbatim' },
        { text: 'page on who can download meeting recordings', type: 'verbatim' }
      ]
    },
    {
      key: 'confluence-raci',
      title: 'RACI for the spring ops migration',
      url: 'https://confluence.example.com/display/OPS/RACI-spring-migration',
      daysAgo: 33,
      clues: [
        { text: 'confluence page with raci for spring ops migration', type: 'verbatim' },
        { text: 'ops wiki about who is responsible for the migration', type: 'paraphrase' }
      ]
    },
    {
      key: 'calendar-allhands',
      title: 'All-hands agenda · September',
      url: 'https://calendar.google.com/calendar/u/0/r/eventedit/yivenoProbeAllHandsSep',
      daysAgo: 2,
      clues: [
        { text: 'calendar event for september all-hands agenda', type: 'verbatim' },
        { text: 'all-hands agenda I bookmarked a couple days ago', type: 'temporal' }
      ]
    }
  ],
  excerpts: [
    {
      key: 'ex-expense',
      pageTitle: 'Expense policy · meals and travel',
      sourceUrl: 'https://www.notion.so/yiveno-probe/Expense-policy-meals-travel',
      selectedText:
        'Per-diem covers meals only when the trip includes an overnight stay away from the home office.',
      daysAgo: 27,
      note: 'client dinner needs pre-approval',
      clues: [
        { text: 'notion excerpt about per-diem covering meals overnight', type: 'verbatim' },
        { text: 'expense clip I annotated about client dinner pre-approval', type: 'note' }
      ]
    },
    {
      key: 'ex-qbr',
      pageTitle: 'QBR talking points — North America',
      sourceUrl: 'https://docs.google.com/document/d/yivenoProbeQbrNa01',
      selectedText:
        'Lead with renewals at risk, then expansion pipeline, then hiring gaps that block delivery.',
      daysAgo: 11,
      clues: [
        { text: 'qbr doc excerpt about leading with renewals at risk', type: 'paraphrase' },
        { text: 'talking points clip on expansion pipeline and hiring gaps', type: 'verbatim' }
      ]
    },
    {
      key: 'ex-slack-status',
      pageTitle: 'How to set a status and pause notifications',
      sourceUrl: 'https://slack.com/help/articles/201864558-Set-your-status-and-availability',
      selectedText:
        'Paused notifications still deliver DMs marked urgent; everything else waits until you clear the status.',
      daysAgo: 4,
      clues: [
        { text: 'slack excerpt about paused notifications and urgent dms', type: 'verbatim' },
        { text: 'help clip on clearing status to resume the queue', type: 'verbatim' }
      ]
    },
    {
      key: 'ex-raci',
      pageTitle: 'RACI for the spring ops migration',
      sourceUrl: 'https://confluence.example.com/display/OPS/RACI-spring-migration',
      selectedText:
        'Finance is Consulted on cutover weekend; Legal is Informed after the first successful dry run.',
      daysAgo: 32,
      note: 'ping legal after dry run',
      clues: [
        {
          text: 'confluence excerpt about finance consulted on cutover weekend',
          type: 'paraphrase'
        },
        { text: 'raci clip I noted to ping legal after dry run', type: 'note' }
      ]
    },
    {
      key: 'ex-pure-note-standup',
      pageTitle: 'Notes',
      sourceUrl: 'https://docs.google.com/document/d/yivenoProbeStandupScrap01',
      selectedText: 'Standup scrap — blockers copied from yesterday.',
      daysAgo: 1,
      note: 'wait on vendor SSO reply',
      clues: [
        { text: 'notes doc where I wrote wait on vendor SSO reply', type: 'note' },
        { text: 'standup scrap annotated about vendor SSO', type: 'note' }
      ]
    }
  ]
}
