export const useSubscriptionForm = () => {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const success = ref(false)

  const submitSubscription = async (payload: {
    email: string
    source?: string
    channel?: string
  }) => {
    loading.value = true
    error.value = null
    success.value = false

    try {
      const response = await $fetch('/api/subscribe', {
        method: 'POST',
        body: payload
      })

      if (response.success) {
        success.value = true
      }

      return response
    } catch (err: unknown) {
      const apiError = err as { data?: { message?: string } }
      error.value = apiError.data?.message || '订阅失败，请稍后重试'
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    success,
    submitSubscription
  }
}
