import { useEffect, useState } from 'react'
import { meApi } from '../../api'
import Feed from '../../components/Feed'

export default function Personal() {
  const [userId, setUserId] = useState('')

  useEffect(() => {
    meApi.status().then((s) => setUserId(s.id)).catch(() => {})
  }, [])

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Feed</h1>
      <Feed isAdmin={false} currentUserId={userId} />
    </div>
  )
}
