/**
 * 联系表单提交处理
 */
export const useContactForm = () => {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const successMessage = ref<string | null>(null)

  const submitContact = async (payload: {
    name: string
    email: string
    message: string
    website?: string
  }) => {
    loading.value = true
    error.value = null
    successMessage.value = null

    try {
      const response = await $fetch('/api/contact', {
        method: 'POST',
        body: payload
      })

      if (response.success) {
        successMessage.value = response.message
      }

      return response
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
    successMessage,
    submitContact
  }
}
