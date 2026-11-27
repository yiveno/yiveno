/** eval 替身：假 Bearer，避免 chrome.storage。 */
export async function getWorkerApiAccessToken(): Promise<string | null> {
  return 'behavior-ablation-eval-fake-token'
}
