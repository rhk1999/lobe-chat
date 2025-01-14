import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { AgentRuntime, ModelProvider } from '@/libs/agent-runtime';
import { LobeVertexAI } from '@/libs/agent-runtime/vertexai';
import { safeParseJSON } from '@/utils/safeParseJSON';

import { POST as UniverseRoute } from '../[provider]/route';

export const POST = async (req: Request) =>
  UniverseRoute(req, {
    createRuntime: () => {
      const credentialsContent =
        process.env.VERTEXAI_CREDENTIALS ??
        (process.env.VERTEXAI_CREDENTIALS_PATH
          ? readFileSync(resolve(process.cwd(), process.env.VERTEXAI_CREDENTIALS_PATH), 'utf8')
          : undefined);

      const googleAuthOptions = credentialsContent ? safeParseJSON(credentialsContent) : undefined;

      const instance = LobeVertexAI.initFromVertexAI({
        googleAuthOptions: googleAuthOptions,
        location: process.env.VERTEXAI_LOCATION,
        project: process.env.VERTEXAI_PROJECT,
      });

      return new AgentRuntime(instance);
    },
    params: Promise.resolve({ provider: ModelProvider.VertexAI }),
  });
