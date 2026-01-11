import { useState, useCallback } from 'react';
import { AppMode } from '../types';
import { DEMO_STATES, DemoState } from '../data/tutorialDemoData';

export interface TutorialStep {
    id: string;
    mode: AppMode | 'LANDING';
    targetElement?: string; // CSS selector for highlighting
    title: string;
    description: string;
    position: 'top' | 'bottom' | 'center';
    action?: string; // Description of required action
    autoAdvance?: boolean; // Auto-advance when mode changes
}

export const TUTORIAL_STEPS: TutorialStep[] = [
    {
        id: 'welcome',
        mode: 'LANDING',
        title: 'ようこそ！',
        description: '京都観光をAIがサポートします。\n**「始める」**をタップして使い方を見てみましょう',
        position: 'center',
        autoAdvance: false
    },
    {
        id: 'spots',
        mode: AppMode.PLANNING,
        targetElement: '[data-tutorial="spot-list"]',
        title: 'スポットを探す',
        description: '周辺の観光地が混雑度とともに表示されます。\n次へ進むと**「赤山禅院」**を選択します。',
        position: 'top',
        autoAdvance: false
    },
    {
        id: 'route',
        mode: AppMode.PLANNING,
        targetElement: '[data-tutorial="route-button"]',
        title: 'ルートを検索',
        description: 'スポットの詳細が表示されます。\n**「ルートを見る」**でアクセス方法を確認できます。',
        position: 'bottom',
        autoAdvance: false
    },
    {
        id: 'route_select',
        mode: AppMode.ROUTE_SELECT,
        targetElement: '[data-tutorial="route-options"]',
        title: 'ルートを選ぶ',
        description: '時間や料金、途中にある観光スポットを比較して最適なルートを選べます。\n次へ進むとナビゲーションを開始します。',
        position: 'top',
        autoAdvance: false
    },
    {
        id: 'nav_start',
        mode: AppMode.NAVIGATING,
        targetElement: '[data-tutorial="guide-widget"]',
        title: 'ナビゲーション開始',
        description: '現在地（京都駅）から目的地までのルート案内を開始します。',
        position: 'top',
        autoAdvance: false
    },
    {
        id: 'nav_transit',
        mode: AppMode.NAVIGATING,
        title: '移動中のサポート',
        description: '移動中は、詳細な交通情報を上部に表示します。\nまた、バス乗車中は現在地表示が切り替わります。',
        position: 'bottom',
        autoAdvance: false
    },
    {
        id: 'nav_arrive',
        mode: AppMode.NAVIGATING,
        title: '目的地周辺',
        description: '目的地に近づきました。\nバスを降りて、ここからは徒歩で向かいます。',
        position: 'bottom',
        autoAdvance: false
    },
    {
        id: 'nav_arrival_complete',
        mode: AppMode.NAVIGATING,
        title: '目的地到着',
        description: '目的地に到着するとガイドからガイド終了の案内に自動で切り替わります。',
        position: 'top',
        autoAdvance: false
    },
    {
        id: 'nav_guide',
        mode: AppMode.NAVIGATING,
        targetElement: '[data-tutorial="guide-widget"]',
        title: '観光ガイド再生',
        description: '到着しました！\nAIがその場所の歴史や見どころを語りかけます。\nこれでチュートリアルは終了です。',
        position: 'center',
        autoAdvance: false
    }
];

export interface UseTutorialResult {
    isActive: boolean;
    isDemoMode: boolean;
    demoState: DemoState | null;
    currentStep: TutorialStep | null;
    stepIndex: number;
    totalSteps: number;
    nextStep: () => void;
    skipTutorial: () => void;
    completeTutorial: () => void;
    startTutorial: () => void;
    handleAction: (actionId: string) => void;
}

export function useTutorial(currentMode: AppMode | 'LANDING', hasSpotSelected: boolean): UseTutorialResult {
    const [isActive, setIsActive] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);

    const currentStep = isActive ? TUTORIAL_STEPS[stepIndex] || null : null;

    // Get demo state for current step
    const demoState: DemoState | null = isActive && currentStep
        ? DEMO_STATES[currentStep.id] || null
        : null;

    // isDemoMode is true when tutorial is active
    const isDemoMode = isActive;

    const nextStep = useCallback(() => {
        if (stepIndex < TUTORIAL_STEPS.length - 1) {
            setStepIndex(prev => prev + 1);
        } else {
            // Complete tutorial
            localStorage.setItem('path_interactive_tutorial_completed', 'true');
            setStepIndex(0);
            setIsActive(false);
        }
    }, [stepIndex]);

    const skipTutorial = useCallback(() => {
        localStorage.setItem('path_interactive_tutorial_completed', 'true');
        setStepIndex(0);
        setIsActive(false);
    }, []);

    const completeTutorial = useCallback(() => {
        localStorage.setItem('path_interactive_tutorial_completed', 'true');
        setStepIndex(0);
        setIsActive(false);
    }, []);

    const startTutorial = useCallback(() => {
        localStorage.removeItem('path_interactive_tutorial_completed');
        setStepIndex(0);
        setIsActive(true);
    }, []);

    const handleAction = useCallback((actionId: string) => {
        if (currentStep?.action === actionId) {
            nextStep();
        }
    }, [currentStep, nextStep]);

    return {
        isActive,
        isDemoMode,
        demoState,
        currentStep,
        stepIndex,
        totalSteps: TUTORIAL_STEPS.length,
        nextStep,
        skipTutorial,
        completeTutorial,
        startTutorial,
        handleAction
    };
}
