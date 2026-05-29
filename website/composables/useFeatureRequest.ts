/**
 * 新功能预约 Composable
 */
export const useFeatureRequest = () => {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const success = ref(false)

  const submitFeatureRequest = async (data: {
    email: string
    feature: string
    description?: string
  }) => {
    loading.value = true
    error.value = null
    success.value = false

    try {
      const response = await $fetch('/api/feature-request', {
        method: 'POST',
        body: data
      })

      if (response.success) {
        success.value = true
        return response
      }
    } catch (err: unknown) {
      const apiError = err as { data?: { message?: string } }
      error.value = apiError.data?.message || '提交失败，请稍后重试'
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    success,
    submitFeatureRequest
  }
}
