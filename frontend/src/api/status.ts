export type StatusResponse = {
  app: string
  ok: boolean
}

export async function fetchStatus(): Promise<StatusResponse> {
  const response = await fetch('/api/status')
  if (!response.ok) {
    throw new Error(`Failed to load status (${response.status})`)
  }
  return (await response.json()) as StatusResponse
}
