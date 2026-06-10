import Feed from '../../components/Feed'

export default function TrainerFeed() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Feed del gimnasio</h1>
      <div className="max-w-xl">
        <Feed isAdmin={true} currentUserId="" />
      </div>
    </div>
  )
}
