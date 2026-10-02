export async function runPool(items, worker, concurrency, onProgress) {
  let index = 0
  let completed = 0
  const failed = []

  async function next() {
    while (index < items.length) {
      const currentIndex = index
      index += 1
      const item = items[currentIndex]
      try {
        const result = await worker(item)
        if (result && result.ok === false) failed.push({ item, result })
      } catch (error) {
        failed.push({ item, result: { ok: false, error: error.message } })
      }
      completed += 1
      onProgress?.(completed, failed.length)
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => next())
  await Promise.all(runners)
  return failed
}
