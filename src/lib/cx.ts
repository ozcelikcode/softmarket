/**
 * Client-side class joiner (clsx, < 1 KB). Use in 'use client' modules instead of `cn`: tailwind-merge
 * (~9 KB gzip) stays in server components. Only valid when the joined classes never conflict
 * (no caller override of the same utility group); otherwise render the element on the server with `cn`.
 */
export { clsx as cx } from 'clsx'
