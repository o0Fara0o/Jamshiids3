/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ReactNode } from 'react';

import { LiveAPIProvider } from './LiveAPIContext';
import { FanAIProvider } from './FanAIContext';
import { JudgeAIProvider } from './JudgeAIContext';
import { APIKeyProvider } from './APIKeyContext';
import { DirectorAIProvider } from './DirectorAIContext';
import { ContentScoutAgentProvider } from './ContentScoutAgentContext';
import { HostAgentProvider } from './HostAgentContext';
import { VirtualSetAgentProvider } from './VirtualSetAgentContext';
import { TTSAIProvider } from './TTSAIContext';
import { EmotionDirectorProvider } from './EmotionDirectorContext';
import { ParserAIProvider } from './ParserAIContext';
import { DescriptionAgentProvider } from './DescriptionAgentContext';
import { FilmDirectorAIProvider } from './FilmDirectorAIContext';
import { VideoAgentProvider } from './VideoAgentContext';
import { ThumbnailAgentProvider } from './ThumbnailAgentContext';

export function AppProviders({ children, apiKey }: { children: ReactNode, apiKey: string }) {
    return (
        <LiveAPIProvider apiKey={apiKey}>
            <APIKeyProvider apiKey={apiKey}>
                <FanAIProvider>
                    <JudgeAIProvider>
                        <DirectorAIProvider>
                            <ContentScoutAgentProvider>
                                <HostAgentProvider>
                                    <VirtualSetAgentProvider>
                                        <TTSAIProvider>
                                            <EmotionDirectorProvider>
                                                <ParserAIProvider>
                                                    <DescriptionAgentProvider>
                                                        <FilmDirectorAIProvider>
                                                            <VideoAgentProvider>
                                                                <ThumbnailAgentProvider>
                                                                    {children}
                                                                </ThumbnailAgentProvider>
                                                            </VideoAgentProvider>
                                                        </FilmDirectorAIProvider>
                                                    </DescriptionAgentProvider>
                                                </ParserAIProvider>
                                            </EmotionDirectorProvider>
                                        </TTSAIProvider>
                                    </VirtualSetAgentProvider>
                                </HostAgentProvider>
                            </ContentScoutAgentProvider>
                        </DirectorAIProvider>
                    </JudgeAIProvider>
                </FanAIProvider>
            </APIKeyProvider>
        </LiveAPIProvider>
    );
}