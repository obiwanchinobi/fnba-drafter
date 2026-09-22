import type { CatWeights } from '../lib/catWeights.ts'

export type WeightSet = {
  id: number
  name: string
  weights: CatWeights
  updated_at: string
}

type WeightSetInput = {
  name: string
  weights: CatWeights
}

export async function fetchWeightSets(): Promise<WeightSet[]> {
  const response = await fetch('/api/weight_sets')
  if (!response.ok) {
    throw new Error(await weightSetErrorMessage(response))
  }
  return (await response.json()) as WeightSet[]
}

export async function createWeightSet(input: WeightSetInput): Promise<WeightSet> {
  const response = await fetch('/api/weight_sets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error(await weightSetErrorMessage(response))
  }
  return (await response.json()) as WeightSet
}

export async function updateWeightSet(
  id: number,
  input: WeightSetInput,
): Promise<WeightSet> {
  const response = await fetch(`/api/weight_sets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error(await weightSetErrorMessage(response))
  }
  return (await response.json()) as WeightSet
}

export async function deleteWeightSet(id: number): Promise<void> {
  const response = await fetch(`/api/weight_sets/${id}`, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error(await weightSetErrorMessage(response))
  }
}

async function weightSetErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: string
      details?: string[]
    }
    if (Array.isArray(body.details)) return body.details.join(', ')
    if (body.error) return body.error
  } catch {
    // non-JSON error bodies still map to a status message
  }
  return `Failed to save weights (${response.status})`
}
