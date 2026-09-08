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
      suggestedClues: [
        'notion page about expense policy for meals and travel',
        'wiki I annotated about receipts before month end'
      ]
    },
    {
      key: 'gdoc-qbr',
      title: 'QBR talking points — North America',
      url: 'https://docs.google.com/document/d/yivenoProbeQbrNa01',
      daysAgo: 12,
      suggestedClues: [
        'google doc with qbr talking points for north america',
        'that quarterly business review talking points doc'
      ]
    },
    {
      key: 'slack-status',
      title: 'How to set a status and pause notifications',
      url: 'https://slack.com/help/articles/201864558-Set-your-status-and-availability',
      daysAgo: 5,
      note: 'focus Friday ritual',
      suggestedClues: [
        'slack help on setting status and pausing notifications',
        'bookmark I noted for focus Friday ritual'
      ]
    },
    {
      key: 'asana-brief',
      title: 'Project brief: Vendor onboarding refresh',
      url: 'https://app.asana.com/0/yiveno-probe/vendor-onboarding-refresh',
      daysAgo: 19,
      suggestedClues: [
        'asana project brief about vendor onboarding refresh',
        'that vendor onboarding project page I saved'
      ]
    },
    {
      key: 'hr-pto',
      title: 'PTO request windows and blackout dates',
      url: 'https://hr.example.com/handbook/pto-blackout-dates',
      daysAgo: 40,
      note: 'check before booking flights',
      suggestedClues: [
        'hr handbook page on pto blackout dates',
        'pto policy bookmark I noted before booking flights'
      ]
    },
    {
      key: 'zoom-recording',
      title: 'Cloud recording retention and who can download',
      url: 'https://support.zoom.com/hc/en/article?id=zm_kb_yiveno_probe_recording',
      daysAgo: 8,
      suggestedClues: [
        'zoom support article about cloud recording retention',
        'page on who can download meeting recordings'
      ]
    },
    {
      key: 'confluence-raci',
      title: 'RACI for the spring ops migration',
      url: 'https://confluence.example.com/display/OPS/RACI-spring-migration',
      daysAgo: 33,
      suggestedClues: [
        'confluence page with raci for spring ops migration',
        'ops wiki about who is responsible for the migration'
      ]
    },
    {
      key: 'calendar-allhands',
      title: 'All-hands agenda · September',
      url: 'https://calendar.google.com/calendar/u/0/r/eventedit/yivenoProbeAllHandsSep',
      daysAgo: 2,
      suggestedClues: [
        'calendar event for september all-hands agenda',
        'all-hands agenda I bookmarked a couple days ago'
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
      suggestedClues: [
        'notion excerpt about per-diem covering meals overnight',
        'expense clip I annotated about client dinner pre-approval'
      ]
    },
    {
      key: 'ex-qbr',
      pageTitle: 'QBR talking points — North America',
      sourceUrl: 'https://docs.google.com/document/d/yivenoProbeQbrNa01',
      selectedText:
        'Lead with renewals at risk, then expansion pipeline, then hiring gaps that block delivery.',
      daysAgo: 11,
      suggestedClues: [
        'qbr doc excerpt about leading with renewals at risk',
        'talking points clip on expansion pipeline and hiring gaps'
      ]
    },
    {
      key: 'ex-slack-status',
      pageTitle: 'How to set a status and pause notifications',
      sourceUrl: 'https://slack.com/help/articles/201864558-Set-your-status-and-availability',
      selectedText:
        'Paused notifications still deliver DMs marked urgent; everything else waits until you clear the status.',
      daysAgo: 4,
      suggestedClues: [
        'slack excerpt about paused notifications and urgent dms',
        'help clip on clearing status to resume the queue'
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
      suggestedClues: [
        'confluence excerpt about finance consulted on cutover weekend',
        'raci clip I noted to ping legal after dry run'
      ]
    },
    {
      key: 'ex-pure-note-standup',
      pageTitle: 'Notes',
      sourceUrl: 'https://docs.google.com/document/d/yivenoProbeStandupScrap01',
      selectedText: 'Standup scrap — blockers copied from yesterday.',
      daysAgo: 1,
      note: 'wait on vendor SSO reply',
      suggestedClues: [
        'notes doc where I wrote wait on vendor SSO reply',
        'standup scrap annotated about vendor SSO'
      ]
    }
  ]
}
