import { getProfileView, getDirective } from '@/lib/actions/taste'
import { ProfileView } from '@/components/profile/ProfileView'
import { DirectiveEditor } from '@/components/profile/DirectiveEditor'

export default async function ProfilePage() {
  const [view, directive] = await Promise.all([getProfileView(), getDirective()])
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-4 pb-20">
      <h1 className="text-xl font-semibold">Your taste profile</h1>
      <ProfileView view={view} />
      <DirectiveEditor directive={directive} />
    </main>
  )
}
