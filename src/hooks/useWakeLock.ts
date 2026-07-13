import { useEffect } from 'react'

/**
 * Keep the screen awake while `active` (i.e. while playing), releasing the
 * lock on pause/unmount. The lock is silently re-acquired when the tab
 * becomes visible again — the browser auto-releases it on tab switch.
 * Fails quietly on browsers without the Wake Lock API.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const request = async () => {
      try {
        sentinel = await navigator.wakeLock.request('screen')
        if (cancelled) await sentinel.release()
      } catch {
        // Denied (low battery, etc.) — nothing we can do.
      }
    }
    void request()

    const onVisibility = () => {
      if (!cancelled && document.visibilityState === 'visible') void request()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      sentinel?.release().catch(() => {})
    }
  }, [active])
}
