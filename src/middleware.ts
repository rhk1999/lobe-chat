import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { UAParser } from 'ua-parser-js';
import urlJoin from 'url-join';

import { authEnv } from '@/config/auth';
import { LOBE_LOCALE_COOKIE } from '@/const/locale';
import { LOBE_THEME_APPEARANCE } from '@/const/theme';
import NextAuthEdge from '@/libs/next-auth/edge';
import { parseBrowserLanguage } from '@/utils/locale';
import { RouteVariants } from '@/utils/server/routeVariants';

import { OAUTH_AUTHORIZED } from './const/auth';

export const config = {
  matcher: [
    // include any files in the api or trpc folders that might have an extension
    '/(api|trpc|webapi)(.*)',
    // include the /
    '/',
    '/discover(.*)',
    '/chat(.*)',
    '/settings(.*)',
    '/files(.*)',
    '/repos(.*)',
    // ↓ cloud ↓
  ],
};

const defaultMiddleware = (request: NextRequest) => {
  // 1. 从 cookie 中读取用户偏好
  const theme = request.cookies.get(LOBE_THEME_APPEARANCE)?.value || 'light';

  // if it's a new user, there's no cookie
  // So we need to use the fallback language parsed by accept-language
  const browserLanguage = parseBrowserLanguage(request.headers);
  const locale = request.cookies.get(LOBE_LOCALE_COOKIE)?.value || browserLanguage;

  const ua = request.headers.get('user-agent');

  const device = new UAParser(ua || '').getDevice();

  // 2. 创建规范化的偏好值
  const route = RouteVariants.serializeVariants({
    isMobile: device.type === 'mobile',
    locale,
    theme,
  });

  const url = new URL(request.url);
  if (['/api', '/trpc', '/webapi'].some((path) => url.pathname.startsWith(path)))
    return NextResponse.next();

  // 3. 处理 URL 重写
  // 构建新路径: /${route}${originalPathname}
  const nextPathname = `/${urlJoin(route, url.pathname)}`;
  // console.log('[origin]', url.pathname, '-> [rewrite]', nextPathname);
  url.pathname = nextPathname;

  const response = NextResponse.rewrite(url);

  const requestOrigin = request.headers.get('origin');

  if (requestOrigin) {
    response.headers.set('Access-Control-Allow-Origin', requestOrigin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
    );

    // 如果是预检请求，确保返回正确的状态码
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        headers: response.headers,
        status: 200,
      });
    }
  }

  return response;
};

const publicRoute = ['/', '/discover'];

// Initialize an Edge compatible NextAuth middleware
const nextAuthMiddleware = NextAuthEdge.auth((req) => {
  const response = defaultMiddleware(req);
  // skip the '/' route
  if (publicRoute.some((url) => req.nextUrl.pathname.startsWith(url))) return response;

  // Just check if session exists
  const session = req.auth;

  // Check if next-auth throws errors
  // refs: https://github.com/lobehub/lobe-chat/pull/1323
  const isLoggedIn = !!session?.expires;

  // Remove & amend OAuth authorized header
  response.headers.delete(OAUTH_AUTHORIZED);
  if (isLoggedIn) {
    response.headers.set(OAUTH_AUTHORIZED, 'true');
  }

  return response;
});

const isProtectedRoute = createRouteMatcher([
  '/settings(.*)',
  '/files(.*)',
  // ↓ cloud ↓
]);

export default authEnv.NEXT_PUBLIC_ENABLE_CLERK_AUTH
  ? clerkMiddleware(
      async (auth, req) => {
        if (isProtectedRoute(req)) await auth.protect();
      },
      {
        // https://github.com/lobehub/lobe-chat/pull/3084
        clockSkewInMs: 60 * 60 * 1000,
        signInUrl: '/login',
        signUpUrl: '/signup',
      },
    )
  : authEnv.NEXT_PUBLIC_ENABLE_NEXT_AUTH
    ? nextAuthMiddleware
    : defaultMiddleware;
