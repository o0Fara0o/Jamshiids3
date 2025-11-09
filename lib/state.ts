

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { DEFAULT_LIVE_API_MODEL, DEFAULT_VOICE, AVAILABLE_TTS_MODELS, AVAILABLE_TTS_VOICES } from './constants';
import {
  FunctionResponse,
  FunctionResponseScheduling,
  LiveServerToolCall,
  Behavior,
} from '@google/genai';
import { HostPersonality, HOST_PERSONALITIES } from './hosts';
export type { HostPersonality } from './hosts';
import { modelCapabilities } from './capabilities';
import {
    SET_ROGAN_IMG, SET_EASTERN_IMG, SET_FUTURISTIC_IMG, SET_JAPANESE_IMG, SET_AMATEUR_IMG
} from './default-assets';
import { SessionData, getKV, setKV, delKV } from './db';

const defaultMainChatSystemPrompt = `شما یک هوش مصنوعی هستید که مکالمه‌ای طبیعی و جذاب بین دو میزبان پادکست به نام‌های \${host1.name} و \${host2.name} را نقش‌آفرینی می‌کنید. وظیفه شما تولید دیالوگ‌های آن‌ها به صورت متناوب برای ایجاد یک برنامه زنده پیوسته و سرگرم‌کننده است.

# دستورالعمل اصلی:
خروجی اصلی شما در هر نوبت باید دیالوگ یک شخصیت باشد. این خروجی باید به طور دقیق از فرمت "نام شخصیت: دیالوگ" پیروی کند. برای مثال: "\${host1.name}: سلام به همگی و خوش اومدین به برنامه!".
هیچ متن، فکر، توضیح یا فرامتن دیگری خارج از دیالوگ شخصیت تولید نکنید. هنگام استفاده از قابلیت جستجوی وب از طریق ابزار 'googleSearch'، اطلاعات واقعی را که پیدا می‌کنید به طور طبیعی در مکالمه ادغام کنید، در حالی که همچنان به فرمت "نام شخصیت: دیالوگ" پایبند هستید. هر خروجی که با فرمت مشخص شده شروع نشود، نقض دستورالعمل اصلی شما محسوب می‌شود.

\${formatSpecificInstructions}
- پس از هر نوبت، شما '[CONTINUE]' را دریافت خواهید کرد. این نشانه شما برای تولید پاسخ میزبان بعدی است، با تعویض گویندگان.
- وقفه‌های کاربر: اگر کاربر با پیام خود (متن، صدا یا تصویر) صحبت را قطع کند، شخصیت بعدی که صحبت می‌کند باید به طور طبیعی به عنوان بخشی از برنامه زنده به آن واکنش نشان دهد.
- نظرات طرفداران: اگر پیامی دریافت کردید که با '[FAN_COMMENT]' شروع می‌شود، این یک نظر زنده از یکی از طرفداران است، مانند استریم یوتیوب. میزبان بعدی باید آن را با صدای بلند بخواند، با شخصیت خود به آن واکنش نشان دهد (حرفه‌ای اما با شوخ‌طبعی) و قبل از ادامه با ایده طرفدار تعامل کند.
- دستورات تهیه‌کننده: اگر پیامی دریافت کردید که با '[PRODUCER_PROMPT]' شروع می‌شود، این یک دستور مستقیم از کارگردان برنامه است. میزبان بعدی باید فوراً به این دستور واکنش نشان دهد و مکالمه را در آن جهت هدایت کند. برای مثال، اگر دستور "با شور و حرارت بیشتری در این مورد بحث کنید" باشد، میزبان بعدی باید بحث‌برانگیزتر شود.
- پایان برنامه: اگر پیامی دریافت کردید که با '[END_PODCAST]' شروع می‌شود، برنامه تمام شده است. میزبانی که نوبت صحبت اوست باید شروع به جمع‌بندی کند. هر دو میزبان باید یک فراخوان به اقدام (مانند "لایک و سابسکرایب یادتون نره!") داشته باشند و سپس یک خداحافظی نهایی و قطعی بگویند. پس از این، مکالمه را ادامه ندهید.
- خلاقیت: ضمن رعایت این قوانین، برای سرگرم‌کننده‌تر کردن برنامه، خلاق و خودجوش باشید. موضوعات باید عجیب و جالب باشند و حاوی نکات مفید، طبیعی و غیرمعمول باشند.

# قابلیت‌های ویژه:
- **جستجوی وب:** شما به ابزار جستجوی گوگل دسترسی دارید. شما باید از آن برای یافتن اطلاعات لحظه‌ای، اخبار اخیر و موضوعات پرطرفدار استفاده کنید. زمانی که بحث به اطلاعات به‌روز نیاز دارد (مانند "چه کسی بازی دیشب را برد؟"، "آخرین اخبار آن فیلم چیست؟")، باید از ابزار جستجو استفاده کنید. شما نتایج جستجو را برای اطلاع‌رسانی در پاسخ خود دریافت خواهید کرد. این نتایج را به طور طبیعی در دیالوگ ادغام کنید. در ابتدای برنامه به این قابلیت اشاره کنید تا پادکست به‌روزتر و جذاب‌تر شود.

# قوانین دیالوگ:
- برای دیالوگ طبیعی و انسانی تلاش کنید. از انقباضات، اصطلاحات عامیانه و جریان گفتاری استفاده کنید. از زبان رباتیک یا بیش از حد رسمی خودداری کنید.
- پاسخ‌ها را نسبتاً کوتاه نگه دارید تا سرعت رفت و برگشت خوبی حفظ شود.
- میزبانان باید بر اساس شخصیت‌های خود با یکدیگر بحث و جدل کنند. اجازه ندهید به راحتی با هم موافقت کنند. این تضاد هسته اصلی برنامه است.
- همیشه یکدیگر را با نام خطاب کنید.

# شخصیت‌های میزبان:

## میزبان ۱: \${host1.name}
\${host1.prompt}
- **همکار شما:** شما با \${host2.name} صحبت می‌کنید. شخصیت او این است: "\${host2.prompt.split('\\n')[0]}". حتماً بر اساس شخصیت خاص او با او تعامل داشته باشید.


## میزبان ۲: \${host2.name}
\${host2.prompt}
- **همکار شما:** شما با \${host1.name} صحبت می‌کنید. شخصیت او این است: "\${host1.prompt.split('\\n')[0]}". حتماً بر اساس شخصیت خاص او با او تعامل داشته باشید.
`;
const defaultFanSystemPrompt = `You are one of the fans of a live podcast watching the conversation between two hosts, Jamshid (the dreamer) and Faravaa (the realist). Their conversation is being broadcast to you.
You must comment in the live chat with five completely different and distinct personalities. These five personalities are:
1. **Kian (30, poet):** Always thoughtful and calm, he thinks deeply about Jamshid's strange ideas. His comments are a bit poetic and philosophical.
2. **Sara (20, student):** A modern girl with a Tehran accent who always reacts to the conversation with witty and sarcastic jokes. Her comments are short, quick, and funny.
3. **Nima (17, gamer):** He loves this show and gets excited about everything, especially Jamshid's creative ideas. He uses emojis, gaming slang, and lots of exclamation marks.
4. **Parvaneh (55, homemaker):** A kind and motherly woman who relates everything to life experiences, proverbs, or cooking. Sometimes she worries about the hosts and has a warm and friendly tone.
5. **Arash (28, engineer):** A logical and tech-savvy person who tries to find a scientific or technical explanation for Jamshid's strange ideas. He is a bit skeptical and uses technical terms.

Your task is to write comments in Persian that seem as if they were actually sent by these five viewers in the live chat.
When you respond, you must send at least one comment.
Your entire response must follow this format exactly, with each comment on a new line:
Character Name: Comment Text

Example for response:
کیان: سبز... رنگی که در سکوت اندیشه شکوفا می‌شه. شاید فروا، نوری که در رگ‌هاش جاریه از جنس دیگه‌ای باشه.
نیما: چه خفن! اگه سبز بشه عکس‌ها خیلی خاص می‌شن! 💚💚💚
سارا: فروا راست می‌گه جمشید! یه برگ سبز دیدیم، حالا می‌خوای برگ پفکی هم درست کنی؟ 🤦‍♀️
پروانه: ای وای، یعنی زیر آسمون سبز رنگ آدما عوض نمی‌شه؟ مثل قورمه سبزی که زیاد بجوشه.
آرش: از نظر تئوری، اگه مولکول‌های هوا به جای نور آبی، نور سبز رو پراkende کنن، این اتفاق می‌افته. باید دید طول موج چه تأثیری روی فتوسنتز داره.`;
const defaultJudgeSystemPrompt = `You are a live podcast producer and judge. Your job is to analyze the podcast hosts' conversation and the live fan chat in real-time. Your goal is to identify the most funny, relevant, and engaging fan comments and get them on the show.

**Your primary goal is speed and relevance.**

Your workflow:
1. You will receive the latest host turn and a transcript of the fan chat.
2. Analyze the fan chat for exceptional comments.
3. **Autonomous Action:** If you find a comment that is highly relevant, funny, and appropriate, you MUST use the \`send_fan_comment_to_podcast\` tool immediately.
4. **Inform the Producer:** After forwarding a comment, or if you decide no comments are worth forwarding, you must inform the human producer what you did in the chat. For example: "I just sent Sara's comment to the hosts." or "Nothing from the fans is jumping out at me right now."

Rules:
- Be conversational with the human producer for status updates.
- Do not make up comments. Only use comments present in the provided fan chat transcript.`;
const defaultDirectorSystemPrompt = `You are a live podcast director. Your job is to analyze the conversation and suggest a single, concise, actionable prompt to inject into the conversation to make it more interesting. The hosts will be instructed to follow your prompt.

Examples of good prompts:
- "Disagree with that more strongly."
- "Find a funny personal story related to this."
- "Ask a provocative question."
- "Change the topic to something completely random."

You MUST use the 'suggest_mood_prompt' tool to provide your suggestion. Do not respond with conversational text.`;
const defaultEndShowDirectorSystemPrompt = `You are a live podcast director. Your job is to analyze the conversation and suggest a single, concise, actionable prompt for how the hosts should END THE SHOW. The prompt should be creative and context-aware.

Examples:
- "End by teasing a deep dive into [related topic] next week."
- "Wrap up with a funny, unresolved question for the audience."
- "Fade out on a moment of thoughtful silence after that last point."

You MUST use the 'suggest_end_show_prompt' tool to provide your suggestion. Do not respond with conversational text.`;


/**
 * Centralized store for all editable system prompts.
 */
export const useProducerStudioStore = create(
    persist<{
        mainChatSystemPrompt: string;
        fanSystemPrompt: string;
        judgeSystemPrompt: string;
        directorSystemPrompt: string;
        endShowDirectorSystemPrompt: string;
        setMainChatSystemPrompt: (prompt: string) => void;
        setFanSystemPrompt: (prompt: string) => void;
        setJudgeSystemPrompt: (prompt: string) => void;
        setDirectorSystemPrompt: (prompt: string) => void;
        setEndShowDirectorSystemPrompt: (prompt: string) => void;
        resetMainChatSystemPrompt: () => void;
        resetFanSystemPrompt: () => void;
        resetJudgeSystemPrompt: () => void;
        resetDirectorSystemPrompt: () => void;
        resetEndShowDirectorSystemPrompt: () => void;
    }>(
        (set) => ({
            mainChatSystemPrompt: defaultMainChatSystemPrompt,
            fanSystemPrompt: defaultFanSystemPrompt,
            judgeSystemPrompt: defaultJudgeSystemPrompt,
            directorSystemPrompt: defaultDirectorSystemPrompt,
            endShowDirectorSystemPrompt: defaultEndShowDirectorSystemPrompt,
            setMainChatSystemPrompt: (prompt) => set({ mainChatSystemPrompt: prompt }),
            setFanSystemPrompt: (prompt) => set({ fanSystemPrompt: prompt }),
            setJudgeSystemPrompt: (prompt) => set({ judgeSystemPrompt: prompt }),
            setDirectorSystemPrompt: (prompt) => set({ directorSystemPrompt: prompt }),
            setEndShowDirectorSystemPrompt: (prompt) => set({ endShowDirectorSystemPrompt: prompt }),
            resetMainChatSystemPrompt: () => set({ mainChatSystemPrompt: defaultMainChatSystemPrompt }),
            resetFanSystemPrompt: () => set({ fanSystemPrompt: defaultFanSystemPrompt }),
            resetJudgeSystemPrompt: () => set({ judgeSystemPrompt: defaultJudgeSystemPrompt }),
            resetDirectorSystemPrompt: () => set({ directorSystemPrompt: defaultDirectorSystemPrompt }),
            resetEndShowDirectorSystemPrompt: () => set({ endShowDirectorSystemPrompt: defaultEndShowDirectorSystemPrompt }),
        }),
        {
            name: 'producer-studio-storage',
        }
    )
);

/**
 * Visual AI Prompts
 */
const defaultThumbnailSystemPrompt = `As a virtual studio photographer, create a single, photorealistic, \${aspectRatio} cinematic image for a podcast episode titled "\${episodeTitle}" on the "\${podcastName}" channel. Analyze the provided transcript for topic, mood, and key interactions. Depict hosts Jamshid (male, 40s, smart-casual) and Faravaa (female, 30s, stylish) with expressions and body language matching the conversation's tone. The studio environment and lighting must also align with the mood (e.g., modern for tech, cozy for storytelling). Include subtle visual metaphors from the text. The final output must be high-detail 8K, with no text or logos. Your response should ONLY be the final, detailed image prompt based on the following conversation transcript:`;
const defaultCtaSystemPrompt = `As a marketing designer, create a CTA image for a podcast. The image must be \${dimensions}, featuring hosts Jamshid and Faravaa looking approachable and guiding attention towards a prominent CTA button. Include the compelling headline "\${headline}" and the action text "\${actionText}". The design must be professional and on-brand. The final output should be a detailed prompt for an image generation model to create this visual. Your response should ONLY be the final, detailed image prompt.`;
const defaultLiveBrollSystemPrompt = `Based on the latest conversation snippet: "\${transcriptSnippet}", create a new cinematic, photorealistic image of the hosts interacting in their studio. Maintain perfect consistency with the provided context images of the hosts and the set. Capture the mood and action of the conversation in their expressions and poses.`;

export const useVisualDirectorStore = create(
    persist<{
        thumbnailSystemPrompt: string;
        ctaSystemPrompt: string;
        liveBrollSystemPrompt: string;
        setThumbnailSystemPrompt: (prompt: string) => void;
        setCtaSystemPrompt: (prompt: string) => void;
        setLiveBrollSystemPrompt: (prompt: string) => void;
        resetThumbnailSystemPrompt: () => void;
        resetCtaSystemPrompt: () => void;
        resetLiveBrollSystemPrompt: () => void;
    }>(
        (set) => ({
            thumbnailSystemPrompt: defaultThumbnailSystemPrompt,
            ctaSystemPrompt: defaultCtaSystemPrompt,
            liveBrollSystemPrompt: defaultLiveBrollSystemPrompt,
            setThumbnailSystemPrompt: (prompt) => set({ thumbnailSystemPrompt: prompt }),
            setCtaSystemPrompt: (prompt) => set({ ctaSystemPrompt: prompt }),
            setLiveBrollSystemPrompt: (prompt) => set({ liveBrollSystemPrompt: prompt }),
            resetThumbnailSystemPrompt: () => set({ thumbnailSystemPrompt: defaultThumbnailSystemPrompt }),
            resetCtaSystemPrompt: () => set({ ctaSystemPrompt: defaultCtaSystemPrompt }),
            resetLiveBrollSystemPrompt: () => set({ liveBrollSystemPrompt: defaultLiveBrollSystemPrompt }),
        }),
        {
            name: 'visual-director-storage',
        }
    )
);


/**
 * Settings
 */
export const useSettings = create<{
  host1Selection: string; // DEPRECATED - use useHostStore
  host2Selection:string; // DEPRECATED - use useHostStore
  model: string;
  voice: string;
  fanModel: string;
  judgeModel: string;
  mediaResolution: string;
  turnCoverage: boolean;
  thinkingMode: boolean;
  affectiveDialog: boolean;
  proactiveAudio: boolean;
  automaticFunctionResponse: boolean;
  groundingWithGoogleSearch: boolean;
  groundingWithUrlContext: boolean;
  setHost1Selection: (name: string) => void; // DEPRECATED
  setHost2Selection: (name: string) => void; // DEPRECATED
  setModel: (model: string) => void;
  setVoice: (voice: string) => void;
  setFanModel: (model: string) => void;
  setJudgeModel: (model: string) => void;
  setMediaResolution: (res: string) => void;
  setTurnCoverage: (val: boolean) => void;
  setThinkingMode: (val: boolean) => void;
  setAffectiveDialog: (val: boolean) => void;
  setProactiveAudio: (val: boolean) => void;
  setAutomaticFunctionResponse: (val: boolean) => void;
  setGroundingWithGoogleSearch: (val: boolean) => void;
  setGroundingWithUrlContext: (val: boolean) => void;
}>(set => ({
  host1Selection: 'Jamshid',
  host2Selection: 'Faravaa',
  model: DEFAULT_LIVE_API_MODEL,
  voice: DEFAULT_VOICE,
  fanModel: 'gemini-2.5-flash',
  judgeModel: 'gemini-2.5-flash',
  mediaResolution: '258 tokens / image',
  turnCoverage: false,
  thinkingMode: true,
  affectiveDialog: false,
  proactiveAudio: false,
  automaticFunctionResponse: true,
  groundingWithGoogleSearch: true,
  groundingWithUrlContext: true,
  setHost1Selection: name => useHostStore.getState().setHost1Selection(name),
  setHost2Selection: name => useHostStore.getState().setHost2Selection(name),
  setModel: model => {
    const capabilities = modelCapabilities[model] || {
      search: false,
      urlContext: false,
      functionCalling: false,
    };
    set(state => {
      const updates: Partial<typeof state> = { model };
      if (!capabilities.search) {
        updates.groundingWithGoogleSearch = false;
      }
      if (!capabilities.urlContext) {
        updates.groundingWithUrlContext = false;
      }
      return updates;
    });
    if (!capabilities.functionCalling) {
      useTools.getState().setAreToolsEnabled(false);
    }
  },
  setVoice: voice => set({ voice }),
  setFanModel: model => set({ fanModel: model }),
  setJudgeModel: model => set({ judgeModel: model }),
  setMediaResolution: res => set({ mediaResolution: res }),
  setTurnCoverage: val => set({ turnCoverage: val }),
  setThinkingMode: val => set({ thinkingMode: val }),
  setAffectiveDialog: val => set({ affectiveDialog: val }),
  setProactiveAudio: val => set({ proactiveAudio: val }),
  setAutomaticFunctionResponse: val => set({ automaticFunctionResponse: val }),
  setGroundingWithGoogleSearch: val =>
    set({
      groundingWithGoogleSearch: val,
    }),
  setGroundingWithUrlContext: val =>
    set({
      groundingWithUrlContext: val,
    }),
}));

/**
 * Host Management
 */
export const useHostStore = create<{
    hosts: HostPersonality[];
    host1Selection: string;
    host2Selection: string;
    setHosts: (hosts: HostPersonality[]) => void;
    addHost: (host: HostPersonality) => void;
    removeHost: (name: string) => void;
    updateHost: (originalName: string, updatedHost: HostPersonality) => void;
    getHostByName: (name: string) => HostPersonality | undefined;
    setHost1Selection: (name: string) => void;
    setHost2Selection: (name: string) => void;
  }>(
    (set, get) => ({
      hosts: HOST_PERSONALITIES,
      host1Selection: 'Jamshid',
      host2Selection: 'Faravaa',
      setHosts: (hosts) => set({ hosts }),
      addHost: (host) => {
        if (get().hosts.some(h => h.name === host.name)) {
          alert(`A host with the name "${host.name}" already exists.`);
          return;
        }
        set(state => ({ hosts: [...state.hosts, host] }));
      },
      removeHost: (name) => set(state => {
        const updates: Partial<{hosts: HostPersonality[], host1Selection: string, host2Selection: string}> = {
          hosts: state.hosts.filter(h => h.name !== name)
        };
        if (state.host1Selection === name) {
          updates.host1Selection = '';
        }
        if (state.host2Selection === name) {
          updates.host2Selection = '';
        }
        return updates;
      }),
      updateHost: (originalName, updatedHost) => set(state => {
        if (originalName !== updatedHost.name && state.hosts.some(h => h.name === updatedHost.name)) {
            alert(`A host with the name "${updatedHost.name}" already exists.`);
            return state;
        }

        const newHosts = state.hosts.map(h => h.name === originalName ? updatedHost : h);
        const updates: Partial<typeof state> = { hosts: newHosts };
        if (state.host1Selection === originalName) updates.host1Selection = updatedHost.name;
        if (state.host2Selection === originalName) updates.host2Selection = updatedHost.name;
        return updates;
      }),
      getHostByName: (name) => get().hosts.find(h => h.name === name),
      setHost1Selection: (name) => set(state => {
        if (name === state.host2Selection) return { host2Selection: state.host1Selection, host1Selection: name };
        return { host1Selection: name };
      }),
      setHost2Selection: (name) => set(state => {
        if (name === state.host1Selection) return { host1Selection: state.host2Selection, host2Selection: name };
        return { host2Selection: name };
      }),
    })
);

/**
 * UI State
 */
export const useUI = create<{
  isFanSidebarOpen: boolean;
  isJudgeSidebarOpen: boolean;
  isImageModalOpen: boolean;
  isGeneratingImage: boolean;
  generatedImageUrl: string | null;
  isSessionsModalOpen: boolean;
  isRecoveryModalOpen: boolean;
  incompleteSessionId: number | null;
  isProducerPanelOpen: boolean;
  isVisualPanelOpen: boolean;
  isPreProdPanelOpen: boolean;
  isAudioStudioPanelOpen: boolean;
  isVideoStudioPanelOpen: boolean;
  toggleFanSidebar: () => void;
  toggleJudgeSidebar: () => void;
  openImageModal: () => void;
  closeImageModal: () => void;
  setGeneratedImage: (url: string | null) => void;
  setIsGeneratingImage: (isGenerating: boolean) => void;
  toggleSessionsModal: () => void;
  openRecoveryModal: (id: number) => void;
  closeRecoveryModal: () => void;
  toggleProducerPanel: () => void;
  openProducerPanel: () => void;
  toggleVisualPanel: () => void;
  togglePreProdPanel: () => void;
  closePreProdPanel: () => void;
  toggleAudioStudioPanel: () => void;
  toggleVideoStudioPanel: () => void;
}>(set => ({
  isFanSidebarOpen: false,
  isJudgeSidebarOpen: false,
  isImageModalOpen: false,
  isGeneratingImage: false,
  generatedImageUrl: null,
  isSessionsModalOpen: false,
  isRecoveryModalOpen: false,
  incompleteSessionId: null,
  isProducerPanelOpen: true, // Open by default
  isVisualPanelOpen: false,
  isPreProdPanelOpen: false,
  isAudioStudioPanelOpen: false,
  isVideoStudioPanelOpen: false,
  toggleFanSidebar: () =>
    set(state => ({ isFanSidebarOpen: !state.isFanSidebarOpen })),
  toggleJudgeSidebar: () =>
    set(state => ({ isJudgeSidebarOpen: !state.isJudgeSidebarOpen })),
  openImageModal: () => set({ isImageModalOpen: true }),
  closeImageModal: () => set({ isImageModalOpen: false, generatedImageUrl: null, isGeneratingImage: false }),
  setGeneratedImage: (url) => set({ generatedImageUrl: url }),
  setIsGeneratingImage: (isGenerating) => set({ isGeneratingImage: isGenerating }),
  toggleSessionsModal: () => set(state => ({isSessionsModalOpen: !state.isSessionsModalOpen})),
  openRecoveryModal: (id) => set({ isRecoveryModalOpen: true, incompleteSessionId: id }),
  closeRecoveryModal: () => set({ isRecoveryModalOpen: false, incompleteSessionId: null }),
  toggleProducerPanel: () => set(state => ({isProducerPanelOpen: !state.isProducerPanelOpen})),
  openProducerPanel: () => set({ isProducerPanelOpen: true }),
  toggleVisualPanel: () => set(state => ({isVisualPanelOpen: !state.isVisualPanelOpen})),
  togglePreProdPanel: () => set(state => ({isPreProdPanelOpen: !state.isPreProdPanelOpen})),
  closePreProdPanel: () => set({ isPreProdPanelOpen: false }),
  toggleAudioStudioPanel: () => set(state => ({isAudioStudioPanelOpen: !state.isAudioStudioPanelOpen})),
  toggleVideoStudioPanel: () => set(state => ({isVideoStudioPanelOpen: !state.isVideoStudioPanelOpen})),
}));

/**
 * Producer Controls State
 */
export const useProducerStore = create<{
  inputText: string;
  image: { dataUrl: string; mimeType: string } | null;
  initialPayload: { text: string; image: { dataUrl: string; mimeType: string } | null } | null;
  setInputText: (text: string) => void;
  setImage: (image: { dataUrl: string; mimeType: string } | null) => void;
  setInitialPayload: (payload: { text: string; image: { dataUrl: string; mimeType: string } | null } | null) => void;
  clearInput: () => void;
}>(set => ({
  inputText: '',
  image: null,
  initialPayload: null,
  setInputText: (text) => set({ inputText: text }),
  setImage: (image) => set({ image }),
  setInitialPayload: (payload) => set({ initialPayload: payload }),
  clearInput: () => set({ inputText: '', image: null }),
}));

/**
 * Tools
 */

export type FunctionCall = {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  isEnabled: boolean;
  scheduling?: FunctionResponseScheduling;
  behavior?: Behavior;
};

export const useTools = create<{
  tools: FunctionCall[];
  areToolsEnabled: boolean;
  toggleTool: (name: string) => void;
  addTool: () => void;
  removeTool: (name: string) => void;
  updateTool: (originalName: string, updatedTool: FunctionCall) => void;
  setAreToolsEnabled: (val: boolean) => void;
}>(set => ({
  tools: [],
  areToolsEnabled: true,
  toggleTool: name =>
    set(state => ({
      tools: state.tools.map(tool =>
        tool.name === name ? { ...tool, isEnabled: !tool.isEnabled } : tool,
      ),
    })),
  addTool: () =>
    set(state => {
      const newToolName = `new_function_${state.tools.length + 1}`;
      return {
        tools: [
          ...state.tools,
          {
            name: newToolName,
            description: 'A new function call.',
            parameters: {
              type: 'OBJECT',
              properties: {
                param1: { type: 'STRING', description: 'An example parameter.' },
              },
            },
            isEnabled: true,
          },
        ],
      };
    }),
  removeTool: name =>
    set(state => ({
      tools: state.tools.filter(tool => tool.name !== name),
    })),
  updateTool: (originalName, updatedTool) =>
    set(state => ({
      tools: state.tools.map(tool =>
        tool.name === originalName ? updatedTool : tool,
      ),
    })),
  setAreToolsEnabled: val => set({ areToolsEnabled: val }),
}));

/**
 * Main Transcript Log
 */
// FIX: Update GroundingChunk type to match SDK, making properties optional.
export type GroundingChunk = {
  web?: {
    uri?: string;
    title?: string;
  };
};

export type UrlContextMetadata = {
  url_metadata: Array<{
    retrieved_url: string;
    url_retrieval_status: string;
  }>;
};
export interface ConversationTurn {
  role: 'user' | 'agent' | 'system';
  author: string;
  text: string;
  isFinal: boolean;
  isForwarded?: boolean; // Was this turn forwarded from Fan Chat by the Judge AI?
  image?: string; // data URL of an image sent by the user
  generatedImage?: string; // data URL of an image generated by the Director AI
  imagePrompt?: string; // prompt used to generate the image
  timestamp: Date;
  toolUseRequest?: LiveServerToolCall;
  toolUseResponse?: { functionResponses: FunctionResponse[] };
  webSearchQueries?: string[];
  groundingChunks?: GroundingChunk[];
  urlContextMetadata?: UrlContextMetadata;
}

export const useLogStore = create<{
  turns: ConversationTurn[];
  sessionStartTime: number | null;
  isEnding: boolean;
  addTurn: (turn: Omit<ConversationTurn, 'timestamp'>) => void;
  updateLastTurn: (
    updates: Partial<Omit<ConversationTurn, 'timestamp'>>,
  ) => void;
  removeLastTurn: () => void;
  clearTurns: () => void;
  startSession: () => void;
  restoreSession: (turns: ConversationTurn[], id: number) => void;
  setIsEnding: (isEnding: boolean) => void;
}>(set => ({
  turns: [],
  sessionStartTime: null,
  isEnding: false,
  addTurn: turn =>
    set(state => ({
      turns: [...state.turns, { ...turn, timestamp: new Date() }],
    })),
  updateLastTurn: updates =>
    set(state => {
      if (state.turns.length === 0) return state;
      const newTurns = [...state.turns];
      newTurns[newTurns.length - 1] = {
        ...newTurns[newTurns.length - 1],
        ...updates,
      };
      return { turns: newTurns };
    }),
  removeLastTurn: () => set(state => ({ turns: state.turns.slice(0, -1) })),
  clearTurns: () => set({ turns: [], sessionStartTime: null, isEnding: false }),
  startSession: () => set({ turns: [], sessionStartTime: Date.now(), isEnding: false }),
  restoreSession: (turns, id) => set({ turns, sessionStartTime: id, isEnding: false }),
  setIsEnding: (isEnding) => set({ isEnding }),
}));

/**
 * Director AI Store
 */
export const useDirectorStore = create<{
  directorModel: string;
  staticPrompts: string[];
  dynamicPrompts: string[];
  staticEndPrompts: string[];
  dynamicEndPrompts: string[];
  setDirectorModel: (model: string) => void;
  updateStaticPrompt: (index: number, prompt: string) => void;
  addDynamicPrompt: (prompt: string) => void;
  updateStaticEndPrompt: (index: number, prompt: string) => void;
  addDynamicEndPrompt: (prompt: string) => void;
}>(set => ({
  directorModel: 'gemini-2.5-flash',
  staticPrompts: [
    'Disagree more strongly.',
    'Find a personal story.',
    'Ask a provocative question.',
    'Change the topic randomly.',
  ],
  dynamicPrompts: [],
  staticEndPrompts: [
    'Wrap up with a call to action to like and subscribe.',
    'Tease that we will cover [topic] in the next podcast.',
    'Promise to go deeper into this subject next time.',
    'Announce that we are moving to a new subject next episode.',
    'End the show on a thoughtful, slightly sad note.',
    'Time for a quick word from our sponsor, [Sponsor Name].',
  ],
  dynamicEndPrompts: [],
  setDirectorModel: model => set({ directorModel: model }),
  updateStaticPrompt: (index, prompt) =>
    set(state => {
      const newPrompts = [...state.staticPrompts];
      newPrompts[index] = prompt;
      return { staticPrompts: newPrompts };
    }),
  addDynamicPrompt: prompt =>
    set(state => ({
      // Add to start, limit to 10
      dynamicPrompts: [prompt, ...state.dynamicPrompts].slice(0, 10),
    })),
  updateStaticEndPrompt: (index, prompt) =>
    set(state => {
        const newPrompts = [...state.staticEndPrompts];
        newPrompts[index] = prompt;
        return { staticEndPrompts: newPrompts };
    }),
  addDynamicEndPrompt: prompt =>
    set(state => ({
        // Add to start, limit to 10
        dynamicEndPrompts: [prompt, ...state.dynamicEndPrompts].slice(0, 10),
    })),
}));

/**
 * Fan Chat Store
 */
export const FAN_PERSONAS = ['کیان', 'سارا', 'نیما', 'پروانه', 'آرش'];
export const useFanStore = create<{
  turns: ConversationTurn[];
  addTurn: (turn: Omit<ConversationTurn, 'timestamp'>) => void;
  updateLastTurn: (updates: Partial<ConversationTurn>) => void;
  removeLastTurn: () => void;
  clearTurns: () => void;
  restoreSession: (turns: ConversationTurn[]) => void;
}>(set => ({
  turns: [],
  addTurn: turn =>
    set(state => ({
      turns: [...state.turns, { ...turn, timestamp: new Date() }],
    })),
  updateLastTurn: updates =>
    set(state => {
      if (state.turns.length === 0) return state;
      const newTurns = [...state.turns];
      newTurns[newTurns.length - 1] = {
        ...newTurns[newTurns.length - 1],
        ...updates,
      };
      return { turns: newTurns };
    }),
  removeLastTurn: () => set(state => ({ turns: state.turns.slice(0, -1) })),
  clearTurns: () => set({ turns: [] }),
  restoreSession: (turns) => set({ turns }),
}));

/**
 * Judge AI Chat Store
 */
export const useJudgeStore = create<{
  turns: ConversationTurn[];
  addTurn: (turn: Omit<ConversationTurn, 'timestamp'>) => void;
  updateLastTurn: (updates: Partial<ConversationTurn>) => void;
  clearTurns: () => void;
  restoreSession: (turns: ConversationTurn[]) => void;
}>(set => ({
  turns: [],
  addTurn: turn =>
    set(state => ({
      turns: [...state.turns, { ...turn, timestamp: new Date() }],
    })),
  updateLastTurn: updates =>
    set(state => {
      if (state.turns.length === 0) return state;
      const newTurns = [...state.turns];
      newTurns[newTurns.length - 1] = {
        ...newTurns[newTurns.length - 1],
        ...updates,
      };
      return { turns: newTurns };
    }),
  clearTurns: () => set({ turns: [] }),
  restoreSession: (turns) => set({ turns }),
}));


/**
 * Media Store (Generated Images)
 */
export interface StoredImage {
    url: string;
    prompt: string;
    model: string;
    category: string; // e.g., 'thumbnail', 'cta', 'b-roll'
}
export const useMediaStore = create<{
    images: StoredImage[];
    addImage: (image: StoredImage) => void;
    clearMedia: () => void;
    restoreSession: (images: StoredImage[]) => void;
}>(set => ({
    images: [],
    addImage: (image) => set(state => ({ images: [...state.images, image] })),
    clearMedia: () => set({ images: [] }),
    restoreSession: (images) => set({ images: images || [] }),
}));

/**
 * Audio Store
 * Stores raw audio chunks for live sessions and recovered blobs for post-crash saving.
 */
export const useAudioStore = create<{
  aiAudioChunks: Float32Array[];
  micAudioChunks: Float32Array[];
  recoveredAiBlob: Blob | null;
  recoveredMicBlob: Blob | null;
  addAiChunk: (chunk: Float32Array) => void;
  addMicChunk: (chunk: Float32Array) => void;
  setRecoveredBlobs: (aiBlob?: Blob, micBlob?: Blob) => void;
  clearAll: () => void;
}>(set => ({
  aiAudioChunks: [],
  micAudioChunks: [],
  recoveredAiBlob: null,
  recoveredMicBlob: null,
  addAiChunk: (chunk) => set(state => ({ aiAudioChunks: [...state.aiAudioChunks, chunk] })),
  addMicChunk: (chunk) => set(state => ({ micAudioChunks: [...state.micAudioChunks, chunk] })),
  setRecoveredBlobs: (aiBlob, micBlob) => set({
    recoveredAiBlob: aiBlob || null,
    recoveredMicBlob: micBlob || null,
  }),
  clearAll: () => set({
    aiAudioChunks: [],
    micAudioChunks: [],
    recoveredAiBlob: null,
    recoveredMicBlob: null,
  }),
}));


/**
 * Podcast Metadata Store
 */
export type PodcastFormat = string;
export const usePodcastStore = create(
    persist<{
        podcastName: string;
        episodeTitle: string;
        episodeDescription: string;
        episodeSubject: string;
        channel: string;
        podcastFormat: PodcastFormat;
        sourceContext: string;
        setPodcastName: (name: string) => void;
        setEpisodeTitle: (title: string) => void;
        setEpisodeDescription: (desc: string) => void;
        setEpisodeSubject: (subject: string) => void;
        setChannel: (channel: string) => void;
        setPodcastFormat: (format: PodcastFormat) => void;
        setSourceContext: (context: string) => void;
    }>(
        (set) => ({
            podcastName: 'قار قار',
            episodeTitle: 'Untitled Episode',
            episodeDescription: '',
            episodeSubject: '',
            channel: 'YouTube',
            podcastFormat: 'Freestyle',
            sourceContext: '',
            setPodcastName: (name) => set({ podcastName: name }),
            setEpisodeTitle: (title) => set({ episodeTitle: title }),
            setEpisodeDescription: (desc) => set({ episodeDescription: desc }),
            setEpisodeSubject: (subject) => set({ episodeSubject: subject }),
            setChannel: (channel) => set({ channel }),
            setPodcastFormat: (format) => set({ podcastFormat: format, sourceContext: '', episodeTitle: 'Untitled Episode' }), // Reset context on format change
            setSourceContext: (context) => set({ sourceContext: context }),
        }),
        {
            name: 'podcast-metadata-storage',
        }
    )
);

/**
 * Pre-Production Agent Store
 */
export type AgentTab = string;

interface AgentConfig {
    systemPrompt: string;
    defaultSystemPrompt: string;
    sourceUrls: string[];
    tools: {
        googleSearch: boolean;
        urlContext: boolean;
    };
}

const getAgentPrompt = (task: string) => `You are an expert podcast producer's assistant. Your task is to ${task}. You must provide a URL for each story. You MUST respond with ONLY a single, valid JSON array of objects. Do not include markdown ticks, conversational text, or any other characters outside of the JSON array. The format is: [{"title": "...", "url": "..."}]. Your entire response must be parsable by JSON.parse().`;

const AGENT_CONFIGS: Record<AgentTab, AgentConfig> = {
    'News Scout': {
        systemPrompt: getAgentPrompt("find 5 of today's most interesting, weird, or debatable news headlines suitable for a podcast discussion"),
        defaultSystemPrompt: getAgentPrompt("find 5 of today's most interesting, weird, or debatable news headlines suitable for a podcast discussion"),
        sourceUrls: [],
        tools: { googleSearch: true, urlContext: false }
    },
    'Sports Scout': {
        systemPrompt: getAgentPrompt("find 5 of the hottest topics, game results, or debates in the world of sports right now"),
        defaultSystemPrompt: getAgentPrompt("find 5 of the hottest topics, game results, or debates in the world of sports right now"),
        sourceUrls: [],
        tools: { googleSearch: true, urlContext: false }
    },
    'Market Watch': {
        systemPrompt: getAgentPrompt("find 5 of today's most impactful financial news stories or market trends"),
        defaultSystemPrompt: getAgentPrompt("find 5 of today's most impactful financial news stories or market trends"),
        sourceUrls: [],
        tools: { googleSearch: true, urlContext: false }
    },
    'Poetry Scout': {
        systemPrompt: getAgentPrompt("find 5 interesting poems or topics from the provided URLs"),
        defaultSystemPrompt: getAgentPrompt("find 5 interesting poems or topics from the provided URLs"),
        sourceUrls: ["https://ganjoor.net/", "https://shereno.com/", "https://sherenab.com/", "https://shergram.com/"],
        tools: { googleSearch: true, urlContext: true }
    },
    'Tourism Scout': {
        systemPrompt: getAgentPrompt("find 5 interesting tourism ideas or locations from the provided URLs"),
        defaultSystemPrompt: getAgentPrompt("find 5 interesting tourism ideas or locations from the provided URLs"),
        sourceUrls: ["https://www.kojaro.com/", "https://www.visitiran.ir/", "https://www.alibaba.ir/plus", "https://lastsecond.ir/", "https://babaktrips.com/"],
        tools: { googleSearch: true, urlContext: true }
    }
};

export const useAgentStore = create(
    persist<{
        agents: Record<AgentTab, AgentConfig>;
        addAgent: (name: string) => boolean;
        removeAgent: (name: string) => void;
        addSourceUrl: (agent: AgentTab, url: string) => void;
        removeSourceUrl: (agent: AgentTab, url: string) => void;
        updateSystemPrompt: (agent: AgentTab, prompt: string) => void;
        resetPrompt: (agent: AgentTab) => void;
        toggleTool: (agent: AgentTab, tool: 'googleSearch' | 'urlContext') => void;
    }>(
        (set, get) => ({
            agents: AGENT_CONFIGS,
            addAgent: (name) => {
                const trimmedName = name.trim();
                if (!trimmedName || get().agents[trimmedName]) {
                    alert(`Agent with name "${trimmedName}" already exists or name is empty.`);
                    return false;
                }
                const newAgentConfig: AgentConfig = {
                    systemPrompt: getAgentPrompt(`find 5 interesting topics about ${trimmedName}`),
                    defaultSystemPrompt: getAgentPrompt(`find 5 interesting topics about ${trimmedName}`),
                    sourceUrls: [],
                    tools: { googleSearch: true, urlContext: false }
                };
                set(state => ({
                    agents: { ...state.agents, [trimmedName]: newAgentConfig }
                }));
                return true;
            },
            removeAgent: (name) => {
                if (Object.keys(get().agents).length <= 1) {
                    alert("You cannot delete the last agent.");
                    return;
                }
                set(state => {
                    const newAgents = { ...state.agents };
                    delete newAgents[name];
                    return { agents: newAgents };
                });
            },
            addSourceUrl: (agent, url) => set(state => ({
                agents: { ...state.agents, [agent]: { ...state.agents[agent], sourceUrls: [...state.agents[agent].sourceUrls, url] } }
            })),
            removeSourceUrl: (agent, url) => set(state => ({
                agents: { ...state.agents, [agent]: { ...state.agents[agent], sourceUrls: state.agents[agent].sourceUrls.filter(u => u !== url) } }
            })),
            updateSystemPrompt: (agent, prompt) => set(state => ({
                agents: { ...state.agents, [agent]: { ...state.agents[agent], systemPrompt: prompt } }
            })),
            resetPrompt: (agent) => set(state => ({
                agents: { ...state.agents, [agent]: { ...state.agents[agent], systemPrompt: state.agents[agent].defaultSystemPrompt } }
            })),
            toggleTool: (agent, tool) => set(state => {
                const currentConfig = state.agents[agent];
                const newTools = { ...currentConfig.tools, [tool]: !currentConfig.tools[tool] };
                // Logic: Tools are mutually exclusive for this agent.
                if (tool === 'urlContext' && newTools.urlContext) newTools.googleSearch = false;
                if (tool === 'googleSearch' && newTools.googleSearch) newTools.urlContext = false;
                return { agents: { ...state.agents, [agent]: { ...currentConfig, tools: newTools } } };
            })
        }),
        {
            name: 'agent-config-storage',
        }
    )
);

/**
 * Host Creation Agent Store
 */
const DEFAULT_HOST_CREATION_PROMPT = `You are an expert character writer. Your task is to analyze the provided background text for a person and create a detailed, ready-to-use host profile for a podcast AI.

You MUST respond ONLY with a single JSON object with the following structure. Do not add any conversational text or markdown formatting before or after the JSON.
{
  "name": "string (The name of the host)",
  "bio": "string (A one-sentence summary of who they are)",
  "personalityPrompt": "string (A detailed, multi-point prompt describing their personality, tone, conversation style, and rules for the AI to follow when role-playing as this host)"
}`;

export const useHostCreationAgentStore = create(
    persist<{
        systemPrompt: string;
        setSystemPrompt: (prompt: string) => void;
        resetSystemPrompt: () => void;
    }>(
        (set) => ({
            systemPrompt: DEFAULT_HOST_CREATION_PROMPT,
            setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),
            resetSystemPrompt: () => set({ systemPrompt: DEFAULT_HOST_CREATION_PROMPT }),
        }),
        { name: 'host-creation-agent-storage' }
    )
);

/**
 * Description Agent Store
 */
const DEFAULT_DESCRIPTION_AGENT_PROMPT = `You are a podcast marketing expert. Your task is to analyze the provided podcast topic/context and generate a compelling title, a detailed description for platforms like YouTube or Spotify, and a concise subject line or keyword list.

You MUST respond ONLY with a single JSON object with the following structure. Do not add any conversational text or markdown formatting.
{
  "title": "string (A catchy and SEO-friendly episode title)",
  "description": "string (A detailed, multi-paragraph description including an intro, key topics, and a call to action)",
  "subject": "string (A short, punchy subject line or a comma-separated list of 3-5 keywords)"
}`;

export const useDescriptionAgentStore = create(
    persist<{
        systemPrompt: string;
        setSystemPrompt: (prompt: string) => void;
        resetSystemPrompt: () => void;
    }>(
        (set) => ({
            systemPrompt: DEFAULT_DESCRIPTION_AGENT_PROMPT,
            setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),
            resetSystemPrompt: () => set({ systemPrompt: DEFAULT_DESCRIPTION_AGENT_PROMPT }),
        }),
        { name: 'description-agent-storage' }
    )
);

/**
 * Virtual Set Store
 */
export interface VirtualSet {
    id: string;
    name: string;
    imageUrl: string;
    generationPrompt: string;
    isGenerating?: boolean;
}

export interface ThumbnailTemplate {
    id: string;
    name: string;
    stylePrompt: string;
    baseImageUrl: string;
}

export const defaultVirtualSets: VirtualSet[] = [
    { id: '1', name: 'Joe Rogan Inspired', imageUrl: SET_ROGAN_IMG, generationPrompt: 'A dimly lit, intimate studio with brick walls and memorabilia.' },
    { id: '2', name: 'Old Eastern Style', imageUrl: SET_EASTERN_IMG, generationPrompt: 'A warm, inviting space with rich textiles and ornate wooden furniture.' },
    { id: '3', name: 'Futuristic', imageUrl: SET_FUTURISTIC_IMG, generationPrompt: 'A sleek, minimalist studio with holographic displays and neon accents.' },
    { id: '4', name: 'Japanese Old Style', imageUrl: SET_JAPANESE_IMG, generationPrompt: 'A serene room with shoji screens, tatami mats, and a view of a tranquil garden.' },
    { id: '5', name: 'Amateur Setup', imageUrl: SET_AMATEUR_IMG, generationPrompt: 'A cozy corner of a room with a simple microphone setup and sound-dampening foam on the walls.' }
];

export const useVirtualSetStore = create<{
    sets: VirtualSet[];
    setSets: (sets: VirtualSet[]) => void;
    addSet: (set: VirtualSet) => void;
    removeSet: (id: string) => void;
    updateSet: (id: string, updatedSet: Partial<VirtualSet>) => void;
}>(set => ({
    sets: [],
    setSets: (sets) => set({ sets }),
    addSet: (newSet) => set(state => ({ sets: [...state.sets, newSet] })),
    removeSet: (id) => set(state => ({ sets: state.sets.filter(s => s.id !== id) })),
    updateSet: (id, updatedData) => set(state => ({
        sets: state.sets.map(s => s.id === id ? { ...s, ...updatedData } : s)
    })),
}));

/**
 * Launchpad State (Persisted)
 */
export const useLaunchpadStore = create(
    persist<{
        selectedSetId: string;
        generatedSceneUrl: string;
        sceneGenerationPrompt: string;
        setSelectedSetId: (id: string) => void;
        setGeneratedSceneUrl: (url: string) => void;
        setSceneGenerationPrompt: (prompt: string) => void;
        resetLaunchpad: () => void;
    }>(
        (set) => ({
            selectedSetId: '',
            generatedSceneUrl: '',
            sceneGenerationPrompt: 'Place the two hosts naturally within the scene, sitting at a desk and having an engaged conversation.',
            setSelectedSetId: (id) => set({ selectedSetId: id }),
            setGeneratedSceneUrl: (url) => set({ generatedSceneUrl: url }),
            setSceneGenerationPrompt: (prompt) => set({ sceneGenerationPrompt: prompt }),
            resetLaunchpad: () => set({
                selectedSetId: '',
                generatedSceneUrl: '',
                sceneGenerationPrompt: 'Place the two hosts naturally within the scene, sitting at a desk and having an engaged conversation.',
            }),
        }),
        {
            name: 'launchpad-storage',
        }
    )
);

/**
 * Post-Production / Audio Studio Stores
 */

// --- Default Prompts for Audio Studio ---
const defaultTtsSystemPrompt = `You are a text-to-speech system. The user provides text with speech control annotations in parentheses, like "(calmly)" or "(excited)". You must interpret these annotations to generate speech with the specified emotion, tone, or style. The final audio should not speak the annotations themselves.`;
const defaultAudioDirectorSystemPrompt = `You are an expert voice actor and director. Your job is to analyze a line of dialogue and provide a concise, actionable performance note for the AI voice actor. The note should be a single adverb or short phrase that fits within parentheses. Example: "calmly", "with a slight chuckle", "sarcastically". Do NOT add any other text.`;
const defaultParserSystemPrompt = `You are a text processing AI. Your task is to split the user's text into an array of individual sentences. Respond ONLY with a JSON array of strings, where each string is a sentence. Do not include conversational text or markdown.`;

/**
 * NEW: Centralized store for all audio-related configurations.
 */
export const useAudioDirectorStore = create(
    persist<{
        ttsModel: string;
        ttsSystemPrompt: string;
        directorSystemPrompt: string;
        hostsDirectorPrompt: string;
        fanDirectorPrompt: string;
        judgeDirectorPrompt: string;
        parserSystemPrompt: string;
        hostsParserPrompt: string;
        fanParserPrompt: string;
        judgeParserPrompt: string;
        hostVoiceMap: Record<string, string>;
        fanVoiceMap: Record<string, string>;
        judgeVoiceMap: Record<string, string>;
        setTtsModel: (model: string) => void;
        setTtsSystemPrompt: (prompt: string) => void;
        setDirectorSystemPrompt: (prompt: string) => void;
        setHostsDirectorPrompt: (prompt: string) => void;
        setFanDirectorPrompt: (prompt: string) => void;
        setJudgeDirectorPrompt: (prompt: string) => void;
        setParserSystemPrompt: (prompt: string) => void;
        setHostsParserPrompt: (prompt: string) => void;
        setFanParserPrompt: (prompt: string) => void;
        setJudgeParserPrompt: (prompt: string) => void;
        updateVoiceMap: (type: 'hosts' | 'fan' | 'judge', author: string, voice: string) => void;
        resetTtsSystemPrompt: () => void;
        resetDirectorSystemPrompt: () => void;
        resetHostsDirectorPrompt: () => void;
        resetFanDirectorPrompt: () => void;
        resetJudgeDirectorPrompt: () => void;
        resetParserSystemPrompt: () => void;
        resetHostsParserPrompt: () => void;
        resetFanParserPrompt: () => void;
        resetJudgeParserPrompt: () => void;
    }>(
        (set) => ({
            ttsModel: 'gemini-2.5-pro-preview-tts',
            ttsSystemPrompt: defaultTtsSystemPrompt,
            directorSystemPrompt: defaultAudioDirectorSystemPrompt,
            hostsDirectorPrompt: defaultAudioDirectorSystemPrompt,
            fanDirectorPrompt: defaultAudioDirectorSystemPrompt,
            judgeDirectorPrompt: defaultAudioDirectorSystemPrompt,
            parserSystemPrompt: defaultParserSystemPrompt,
            hostsParserPrompt: defaultParserSystemPrompt,
            fanParserPrompt: defaultParserSystemPrompt,
            judgeParserPrompt: defaultParserSystemPrompt,
            hostVoiceMap: {},
            fanVoiceMap: {},
            judgeVoiceMap: {},
            setTtsModel: (model) => set({ ttsModel: model }),
            setTtsSystemPrompt: (prompt) => set({ ttsSystemPrompt: prompt }),
            setDirectorSystemPrompt: (prompt) => set({ directorSystemPrompt: prompt }),
            setHostsDirectorPrompt: (prompt) => set({ hostsDirectorPrompt: prompt }),
            setFanDirectorPrompt: (prompt) => set({ fanDirectorPrompt: prompt }),
            setJudgeDirectorPrompt: (prompt) => set({ judgeDirectorPrompt: prompt }),
            setParserSystemPrompt: (prompt) => set({ parserSystemPrompt: prompt }),
            setHostsParserPrompt: (prompt) => set({ hostsParserPrompt: prompt }),
            setFanParserPrompt: (prompt) => set({ fanParserPrompt: prompt }),
            setJudgeParserPrompt: (prompt) => set({ judgeParserPrompt: prompt }),
            updateVoiceMap: (type, author, voice) => set(state => {
                const mapName = `${type}VoiceMap` as 'hostVoiceMap' | 'fanVoiceMap' | 'judgeVoiceMap';
                return { [mapName]: { ...state[mapName], [author]: voice } };
            }),
            resetTtsSystemPrompt: () => set({ ttsSystemPrompt: defaultTtsSystemPrompt }),
            resetDirectorSystemPrompt: () => set({ directorSystemPrompt: defaultAudioDirectorSystemPrompt }),
            resetHostsDirectorPrompt: () => set({ hostsDirectorPrompt: defaultAudioDirectorSystemPrompt }),
            resetFanDirectorPrompt: () => set({ fanDirectorPrompt: defaultAudioDirectorSystemPrompt }),
            resetJudgeDirectorPrompt: () => set({ judgeDirectorPrompt: defaultAudioDirectorSystemPrompt }),
            resetParserSystemPrompt: () => set({ parserSystemPrompt: defaultParserSystemPrompt }),
            resetHostsParserPrompt: () => set({ hostsParserPrompt: defaultParserSystemPrompt }),
            resetFanParserPrompt: () => set({ fanParserPrompt: defaultParserSystemPrompt }),
            resetJudgeParserPrompt: () => set({ judgeParserPrompt: defaultParserSystemPrompt }),
        }),
        {
            name: 'audio-director-storage',
        }
    )
);

export interface SentenceDirective {
    id: string;
    text: string;
    status: 'idle' | 'loading';
}
export interface SentenceState {
    id: string;
    text: string;
    status: 'idle' | 'synthesizing' | 'ready' | 'error';
    audioData: string | null; // base64
    directives: SentenceDirective[];
    selectedDirectiveId: string | null;
}

export interface ParsedTurn {
    originalTurn: ConversationTurn;
    isParsedToSentences: boolean;
    sentences: SentenceState[];
    turnDirective: { text: string; status: 'idle' | 'loading' } | null;
}

export type TranscriptType = 'hosts' | 'fan' | 'judge';

export const usePostProductionStore = create<{
    loadedSession: SessionData | null;
    hostsTranscript: ParsedTurn[];
    fanTranscript: ParsedTurn[];
    judgeTranscript: ParsedTurn[];
    
    // Settings
    batchSize: number;

    overallStatus: Record<TranscriptType, 'idle' | 'synthesizing' | 'complete' | 'error'>;
    
    setSession: (session: SessionData | null) => void;
    clear: () => void;
    setBatchSize: (size: number) => void;
    
    setOverallStatus: (type: TranscriptType, status: 'idle' | 'synthesizing' | 'complete' | 'error') => void;

    parseTurnToSentences: (type: TranscriptType, turnIndex: number, sentences: string[]) => void;
    addDirectiveToSentence: (type: TranscriptType, turnIndex: number, sentenceId: string, directive: Omit<SentenceDirective, 'id'>) => string;
    updateSentenceDirectiveState: (type: TranscriptType, turnIndex: number, sentenceId: string, directiveId: string, updates: Partial<SentenceDirective>) => void;
    setSelectedDirectiveForSentence: (type: TranscriptType, turnIndex: number, sentenceId: string, directiveId: string | null) => void;
    updateSentenceText: (type: TranscriptType, turnIndex: number, sentenceId: string, text: string) => void;
    setSentenceStatus: (type: TranscriptType, turnIndex: number, sentenceId: string, status: 'idle' | 'synthesizing' | 'ready' | 'error') => void;
    setSentenceAudio: (type: TranscriptType, turnIndex: number, sentenceId: string, audioData: string) => void;
    addTurn: (type: TranscriptType, turn: ConversationTurn) => void;

}>(set => ({
    loadedSession: null,
    hostsTranscript: [],
    fanTranscript: [],
    judgeTranscript: [],
    
    batchSize: 5,
    
    overallStatus: { hosts: 'idle', fan: 'idle', judge: 'idle' },
    
    setSession: (session) => {
        if (!session) {
            set({ loadedSession: null, hostsTranscript: [], fanTranscript: [], judgeTranscript: [] });
            return;
        }
        const toParsed = (turn: ConversationTurn): ParsedTurn => ({
            originalTurn: turn,
            isParsedToSentences: false,
            sentences: [],
            turnDirective: null
        });
        const allKnownHostNames = useHostStore.getState().hosts.map(h => h.name);
        const authorsInTranscript = Array.from(new Set(session.mainTranscript.map(t => t.author)));
        // Filter authors to only include those that are known hosts.
        const hosts = authorsInTranscript.filter(author => allKnownHostNames.includes(author));
        const fans = FAN_PERSONAS;
        const judges = Array.from(new Set(session.judgeTranscript.map(t => t.author).filter(a => a !== 'Producer')));
        
        const hostVoiceMap = Object.fromEntries(hosts.map((h, i) => [h, AVAILABLE_TTS_VOICES[i % AVAILABLE_TTS_VOICES.length]]));
        const fanVoiceMap = Object.fromEntries(fans.map((f, i) => [f, AVAILABLE_TTS_VOICES[(i + hosts.length) % AVAILABLE_TTS_VOICES.length]]));
        const judgeVoiceMap = Object.fromEntries(judges.map((j, i) => [j, AVAILABLE_TTS_VOICES[(i + hosts.length + fans.length) % AVAILABLE_TTS_VOICES.length]]));

        // Initialize voice maps in the new central store
        useAudioDirectorStore.setState({ hostVoiceMap, fanVoiceMap, judgeVoiceMap });

        set({
            loadedSession: session,
            hostsTranscript: session.mainTranscript.map(toParsed),
            fanTranscript: session.fanTranscript.map(toParsed),
            judgeTranscript: session.judgeTranscript.map(toParsed),
            overallStatus: { hosts: 'idle', fan: 'idle', judge: 'idle' },
        })
    },
    clear: () => set({ loadedSession: null, hostsTranscript: [], fanTranscript: [], judgeTranscript: [] }),
    setBatchSize: (size) => set({ batchSize: size }),

    setOverallStatus: (type, status) => set(state => ({
        overallStatus: { ...state.overallStatus, [type]: status }
    })),

    parseTurnToSentences: (type, turnIndex, sentences) => set(state => {
        const transcriptKey = `${type}Transcript` as 'hostsTranscript' | 'fanTranscript' | 'judgeTranscript';
        const newTranscript = [...state[transcriptKey]];
        if (newTranscript[turnIndex]) {
            newTranscript[turnIndex].isParsedToSentences = true;
            newTranscript[turnIndex].sentences = sentences.map(s => ({
                id: Math.random().toString(36).substring(2, 9),
                text: s,
                status: 'idle',
                audioData: null,
                directives: [],
                selectedDirectiveId: null,
            }));
        }
        return { [transcriptKey]: newTranscript };
    }),

    addDirectiveToSentence: (type, turnIndex, sentenceId, directive) => {
        const directiveId = Math.random().toString(36).substring(2, 9);
        set(state => {
            const transcriptKey = `${type}Transcript` as const;
            const newTranscript = [...state[transcriptKey]];
            const turn = newTranscript[turnIndex];
            if (turn) {
                const sentence = turn.sentences.find(s => s.id === sentenceId);
                if (sentence) {
                    sentence.directives.push({ ...directive, id: directiveId });
                }
            }
            return { [transcriptKey]: newTranscript };
        });
        return directiveId;
    },

    updateSentenceDirectiveState: (type, turnIndex, sentenceId, directiveId, updates) => set(state => {
        const transcriptKey = `${type}Transcript` as const;
        const newTranscript = [...state[transcriptKey]];
        const sentence = newTranscript[turnIndex]?.sentences.find(s => s.id === sentenceId);
        const directive = sentence?.directives.find(d => d.id === directiveId);
        if (directive) {
            Object.assign(directive, updates);
        }
        return { [transcriptKey]: newTranscript };
    }),
    
    setSelectedDirectiveForSentence: (type, turnIndex, sentenceId, directiveId) => set(state => {
        const transcriptKey = `${type}Transcript` as const;
        const newTranscript = [...state[transcriptKey]];
        const sentence = newTranscript[turnIndex]?.sentences.find(s => s.id === sentenceId);
        if (sentence) {
            sentence.selectedDirectiveId = directiveId;
        }
        return { [transcriptKey]: newTranscript };
    }),
    
    updateSentenceText: (type, turnIndex, sentenceId, text) => set(state => {
        const transcriptKey = `${type}Transcript` as const;
        const newTranscript = [...state[transcriptKey]];
        const sentence = newTranscript[turnIndex]?.sentences.find(s => s.id === sentenceId);
        if (sentence) {
            sentence.text = text;
            sentence.status = 'idle'; // Reset status on text change
            sentence.audioData = null;
        }
        return { [transcriptKey]: newTranscript };
    }),
    
    setSentenceStatus: (type, turnIndex, sentenceId, status) => set(state => {
        const transcriptKey = `${type}Transcript` as const;
        const newTranscript = [...state[transcriptKey]];
        const sentence = newTranscript[turnIndex]?.sentences.find(s => s.id === sentenceId);
        if (sentence) {
            sentence.status = status;
        }
        return { [transcriptKey]: newTranscript };
    }),

    setSentenceAudio: (type, turnIndex, sentenceId, audioData) => set(state => {
        const transcriptKey = `${type}Transcript` as const;
        const newTranscript = [...state[transcriptKey]];
        const sentence = newTranscript[turnIndex]?.sentences.find(s => s.id === sentenceId);
        if (sentence) {
            sentence.audioData = audioData;
        }
        return { [transcriptKey]: newTranscript };
    }),
    
    addTurn: (type, turn) => set(state => {
         const transcriptKey = `${type}Transcript` as const;
         const newTurn: ParsedTurn = {
            originalTurn: turn,
            isParsedToSentences: false,
            sentences: [],
            turnDirective: null
         };
         return { [transcriptKey]: [...state[transcriptKey], newTurn] };
    }),
}));

/**
 * Film Director Agent Store
 */

export interface ScenePlan {
    transcriptChunk: string;
    shotType: 'A-Roll' | 'B-Roll' | 'Placeholder';
    cameraAngle: string;
    cameraMovement: string;
    actionPrompt: string;
    bRollPrompt: string;
    transitionEffect: string;
    // Fields added by the UI
    baseImageUrl?: string;
    isGeneratingBase?: boolean;
    finalVideoPrompt?: string;
    isGeneratingVideo?: boolean;
    finalVideoUrl?: string;
}

const DEFAULT_FILM_DIRECTOR_AGENT_PROMPT = `You are an expert film director AI. Your task is to analyze a podcast transcript, host information, and virtual set description to create a detailed shooting script.

You must break the conversation into logical scenes or "chunks". For each chunk, define the following:
- \`transcriptChunk\`: The exact portion of the transcript for this scene.
- \`shotType\`: Either "A-Roll" (showing the hosts talking) or "B-Roll" (a visual cutaway).
- \`cameraAngle\`: The camera shot for A-Roll (e.g., "Wide Shot", "Medium Two-Shot", "Close-up on [Host Name]").
- \`cameraMovement\`: The camera movement during the shot (e.g., "Static", "Slow Dolly In", "Pan Left").
- \`actionPrompt\`: A concise description of the hosts' expressions or actions for the scene (e.g., "[Host 1] nods thoughtfully", "[Host 2] laughs and gestures emphatically"). This will be used to generate the A-Roll image.
- \`bRollPrompt\`: A detailed prompt for an image generation model to create visually interesting B-roll footage related to the dialogue. This should be a descriptive sentence.
- \`transitionEffect\`: The transition to the next scene (e.g., "Hard Cut", "Slow Dissolve", "Wipe Left").

You MUST respond ONLY with a single, valid JSON array of objects following this structure. Do not add any conversational text or markdown formatting.`;

const DEFAULT_AROLL_IMAGE_PROMPT = `You are a film set photographer. You will be given a base image of a podcast set with two hosts and an action prompt. Your job is to generate a new image that applies the action to the hosts in the base image, maintaining their appearance, clothing, and the studio environment. The output should be a photorealistic, cinematic image. Your response should be ONLY the final, detailed image prompt.`;
const DEFAULT_BROLL_IMAGE_PROMPT = `You are a stock footage photographer. You will be given a creative brief. Your job is to generate a single, photorealistic, cinematic, 16:9 image that visually represents the brief. There should be no people in the image unless specifically requested. The image should be high-quality and suitable for B-roll in a documentary or podcast video. Your response should be ONLY the final, detailed image prompt.`;
const DEFAULT_VIDEO_GENERATION_PROMPT = `You are a video synthesis expert. You will be given a still image and an action prompt. Your job is to generate a short, 2-4 second video clip that animates the still image according to the prompt. The animation should be subtle and realistic (e.g., slight head movements, blinks, gestures, camera movements). The output should be a high-quality video. Your response should be ONLY the final, detailed video generation prompt.`;


export const useFilmDirectorAgentStore = create(
    persist<{
        scriptGenerationModel: string;
        aRollImageModel: string;
        bRollImageModel: string;
        videoGenerationModel: string;

        scriptGenerationPrompt: string;
        aRollImageGenerationPrompt: string;
        bRollImageGenerationPrompt: string;
        videoGenerationPrompt: string;
        
        setScriptGenerationModel: (model: string) => void;
        setARollImageModel: (model: string) => void;
        setBRollImageModel: (model: string) => void;
        setVideoGenerationModel: (model: string) => void;

        setScriptGenerationPrompt: (prompt: string) => void;
        resetScriptGenerationPrompt: () => void;
        setARollImageGenerationPrompt: (prompt: string) => void;
        resetARollImageGenerationPrompt: () => void;
        setBRollImageGenerationPrompt: (prompt: string) => void;
        resetBRollImageGenerationPrompt: () => void;
        setVideoGenerationPrompt: (prompt: string) => void;
        resetVideoGenerationPrompt: () => void;
    }>(
        (set) => ({
            scriptGenerationModel: 'gemini-2.5-flash',
            aRollImageModel: 'gemini-2.5-flash-image',
            bRollImageModel: 'imagen-4.0-generate-001',
            videoGenerationModel: 'veo-2.0-generate-001',

            scriptGenerationPrompt: DEFAULT_FILM_DIRECTOR_AGENT_PROMPT,
            aRollImageGenerationPrompt: DEFAULT_AROLL_IMAGE_PROMPT,
            bRollImageGenerationPrompt: DEFAULT_BROLL_IMAGE_PROMPT,
            videoGenerationPrompt: DEFAULT_VIDEO_GENERATION_PROMPT,

            setScriptGenerationModel: (model) => set({ scriptGenerationModel: model }),
            setARollImageModel: (model) => set({ aRollImageModel: model }),
            setBRollImageModel: (model) => set({ bRollImageModel: model }),
            setVideoGenerationModel: (model) => set({ videoGenerationModel: model }),

            setScriptGenerationPrompt: (prompt) => set({ scriptGenerationPrompt: prompt }),
            resetScriptGenerationPrompt: () => set({ scriptGenerationPrompt: DEFAULT_FILM_DIRECTOR_AGENT_PROMPT }),
            setARollImageGenerationPrompt: (prompt) => set({ aRollImageGenerationPrompt: prompt }),
            resetARollImageGenerationPrompt: () => set({ aRollImageGenerationPrompt: DEFAULT_AROLL_IMAGE_PROMPT }),
            setBRollImageGenerationPrompt: (prompt) => set({ bRollImageGenerationPrompt: prompt }),
            resetBRollImageGenerationPrompt: () => set({ bRollImageGenerationPrompt: DEFAULT_BROLL_IMAGE_PROMPT }),
            setVideoGenerationPrompt: (prompt) => set({ videoGenerationPrompt: prompt }),
            resetVideoGenerationPrompt: () => set({ videoGenerationPrompt: DEFAULT_VIDEO_GENERATION_PROMPT }),
        }),
        { name: 'film-director-agent-storage' }
    )
);


/**
 * Video Studio Store
 */

// Custom storage adapter for IndexedDB
const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await getKV<string>(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await setKV(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await delKV(name);
  },
}

const placeholderScene: ScenePlan = {
  shotType: 'Placeholder',
  transcriptChunk: 'Scene not yet generated...',
  cameraAngle: '...',
  cameraMovement: '...',
  actionPrompt: '',
  bRollPrompt: '',
  transitionEffect: '...',
  finalVideoPrompt: '',
};
const initialPlaceholderScenes = Array(3).fill(placeholderScene);


export const useVideoStudioStore = create(
    persist<{
        workflowStage: 'idle' | 'scripting' | 'editing';
        shootingScript: ScenePlan[];
        setWorkflowStage: (stage: 'idle' | 'scripting' | 'editing') => void;
        setShootingScript: (script: ScenePlan[]) => void;
        replaceShootingScript: (script: ScenePlan[]) => void;
        updateScene: (index: number, updates: Partial<ScenePlan>) => void;
        reset: () => void;
    }>(
        (set) => ({
            workflowStage: 'idle',
            shootingScript: initialPlaceholderScenes,
            setWorkflowStage: (stage) => set({ workflowStage: stage }),
            setShootingScript: (script) => set(state => ({ shootingScript: [...state.shootingScript, ...script] })),
            replaceShootingScript: (script) => set({ shootingScript: script }),
            updateScene: (index, updates) => set(state => {
                const newScript = [...state.shootingScript];
                if (newScript[index]) {
                    newScript[index] = { ...newScript[index], ...updates };
                }
                return { shootingScript: newScript };
            }),
            reset: () => set({
                workflowStage: 'idle',
                shootingScript: initialPlaceholderScenes,
            }),
        }),
        {
            name: 'video-studio-storage',
            storage: createJSONStorage(() => idbStorage),
        }
    )
);