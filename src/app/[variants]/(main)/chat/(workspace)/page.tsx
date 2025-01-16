import { Suspense } from 'react';

import StructuredData from '@/components/StructuredData';
import { serverFeatureFlags } from '@/config/featureFlags';
import { BRANDING_NAME } from '@/const/branding';
import { ldModule } from '@/server/ld';
import { metadataModule } from '@/server/metadata';
import { translation } from '@/server/translation';
import { DynamicLayoutProps } from '@/types/next';
import { RouteVariants } from '@/utils/server/routeVariants';

import PageTitle from '../features/PageTitle';
import Changelog from './features/ChangelogModal';
import TelemetryNotification from './features/TelemetryNotification';

export const generateMetadata = async () => {
  const { t } = await translation('metadata');
  return metadataModule.generate({
    description: t('chat.description', { appName: BRANDING_NAME }),
    title: t('chat.title', { appName: BRANDING_NAME }),
    url: '/chat',
  });
};

const Page = async (props: DynamicLayoutProps) => {
  const { t } = await translation('metadata');

  const isMobile = await RouteVariants.getIsMobile(props);
  const { hideDocs, showChangelog } = serverFeatureFlags();

  const ld = ldModule.generate({
    description: t('chat.description', { appName: BRANDING_NAME }),
    title: t('chat.title', { appName: BRANDING_NAME }),
    url: '/chat',
  });

  return (
    <>
      <StructuredData ld={ld} />
      <PageTitle />
      <TelemetryNotification mobile={isMobile} />
      {showChangelog && !hideDocs && !isMobile && (
        <Suspense>
          <Changelog />
        </Suspense>
      )}
    </>
  );
};

Page.displayName = 'Chat';

export default Page;

// try revalidate every 2 hours
export const revalidate = 7200;
