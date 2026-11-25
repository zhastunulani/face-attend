interface Toast {
  id: number
  text: string
  kind: 'error' | 'success'
}

let seq = 0

/** API қатесінен оқылатын хабарлама алу (сервер `message` өрісін қазақша жібереді) */
export const apiErrorMessage = (e: any, fallback = 'Қате орын алды') =>
  e?.data?.message || e?.data?.statusMessage || e?.message || fallback

export const useNotify = () => {
  const toasts = useState<Toast[]>('toasts', () => [])

  const push = (text: string, kind: Toast['kind']) => {
    const id = ++seq
    toasts.value = [...toasts.value, { id, text, kind }]
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, 5000)
  }

  return {
    toasts,
    notifyError: (e: any, fallback?: string) => {
      console.error(e)
      push(apiErrorMessage(e, fallback), 'error')
    },
    notifySuccess: (text: string) => push(text, 'success'),
  }
}
