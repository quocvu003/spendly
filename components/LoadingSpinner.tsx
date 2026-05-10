interface LoadingSpinnerProps {
  message?: string
  fullscreen?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const gifSize = { sm: 48, md: 96, lg: 160 }

export default function LoadingSpinner({
  message = 'Đang tải...',
  fullscreen = false,
  size = 'md',
}: LoadingSpinnerProps) {
  const px = gifSize[size]

  const gif = (
    <img
      src="/process.gif"
      alt="Đang tải..."
      width={px}
      height={px}
      style={{ objectFit: 'contain' }}
    />
  )

  if (fullscreen) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-white gap-3">
        {gif}
        {message && <p className="text-gray-400 text-sm">{message}</p>}
      </main>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      {gif}
      {message && <p className="text-gray-400 text-sm">{message}</p>}
    </div>
  )
}
