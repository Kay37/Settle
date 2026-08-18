import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import type { Category, LearnedRule, Thought } from './types'
import { CATEGORIES } from './types'
import WorryFollowUp, { revisitFridayIso } from './components/WorryFollowUp'
import BrainSweep from './components/BrainSweep'
import { askWithEndpoint, localAsk } from './lib/askShared'
import { brainSweepQueue, markSweepDone, sweepDue } from './lib/brainSweep'
import { findClarifyPrompts } from './lib/clarify'
import { findEchoes } from './lib/duplicates'
import { settleSummary } from './lib/settleSummary'
import { isWaiting } from './lib/waiting'
import { waitingLabel, waitingLoops } from './lib/waitingLoops'
import {
  assign,
  dueLabel,
  isActive,
  snoozeTarget,
} from './lib/assign'
import {
  briefIntro,
  dumpFromLocation,
  greetingForHour,
  searchThoughts,
  splitDump,
  titleFromText,
  urgencyScore,
} from './lib/classify'
import { fileLocally, fileWithEndpoint } from './lib/fileThoughts'
import { learnFromCorrection } from './lib/learn'
import { loadSettings, saveSettings, type Settings } from './lib/settings'
import { createRecognizer, speechSupported } from './lib/speech'
import { peopleRadar, staleLabel } from './lib/peopleRadar'
import { personDraft, personMessage } from './lib/personDraft'
import { previewDraft } from './lib/preview'
import { detectProjectHints, type ProjectHint } from './lib/projectHints'
import { gentleInsights } from './lib/insights'
import { looksLikeMindChanged, suggestedCategoryAfterEdit } from './lib/mindChanged'
import { canShare, shareText } from './lib/share'
import { exportJson, loadState, saveState, uid } from './lib/storage'
import { fromSyncCode, mergeSyncState, toSyncCode } from './lib/syncCode'
import { staleDays, staleSweep } from './lib/staleSweep'
import './index.css'

type View = 'brief' | 'all' | 'ask'
type ListFilter = Category | 'all' | 'due' | 'waiting'

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function labelFor(category: Category): string {
  return CATEGORIES.find((c) => c.id === category)?.label ?? category
}
