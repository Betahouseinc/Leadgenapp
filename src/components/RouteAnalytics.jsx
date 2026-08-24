import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

// React Router changes the URL without a page load, so the single page_view
// gtag sends at boot would be the only one GA ever sees. This component owns
// page_view instead: index.html configures GA with send_page_view:false, and
// every view — the first one included — is sent from here.
//
// GA4 enhanced measurement can also emit page_views on history events. Keep
// "Page changes based on browser history events" switched OFF for this data
// stream, or every route change is counted twice.

const TITLES = {
  '/': 'Landing',
  '/login': 'Log in',
  '/signup': 'Sign up',
  '/dashboard': 'Dashboard',
  '/leads': 'Leads',
  '/pricing': 'Pricing',
  '/legal/terms': 'Terms of Service',
  '/legal/privacy': 'Privacy Policy',
  '/reset-password': 'Reset password',
}

function sendPageView(page) {
  // gtag is absent until the visitor accepts analytics cookies.
  if (typeof window.gtag !== 'function') return
  window.gtag('event', 'page_view', {
    page_path: page,
    page_location: window.location.href,
    page_title: document.title,
  })
}

export default function RouteAnalytics() {
  const { pathname, search } = useLocation()
  const page = pathname + search
  const lastSent = useRef(null)

  useEffect(() => {
    const name = TITLES[pathname]
    document.title = name ? `${name} — LeadgenAI` : 'LeadgenAI — AI-Powered Lead Generation'

    // StrictMode remounts effects in dev; never send the same page twice in a row.
    if (lastSent.current === page) return
    lastSent.current = page
    sendPageView(page)
  }, [pathname, page])

  // Accepting cookies loads GA mid-session, after this page's view was skipped.
  // CookieConsent calls this to record the page the visitor accepted on.
  useEffect(() => {
    window.__gaPageView = () => sendPageView(page)
    return () => { delete window.__gaPageView }
  }, [page])

  return null
}
