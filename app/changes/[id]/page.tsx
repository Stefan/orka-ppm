'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '../../../components/AppLayout'
import ChangeRequestDetail from '../components/ChangeRequestDetail'
import ChangeRequestForm from '../components/ChangeRequestForm'

interface ChangeDetailPageProps {
  params: {
    id: string
  }
}

export default function ChangeDetailPage({ params }: ChangeDetailPageProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleBack = () => {
    router.push('/changes')
  }

  const handleFormSubmit = (data: any) => {
    console.log('Updating change request:', data)
    // Handle form submission
    setIsEditing(false)
  }

  const handleFormCancel = () => {
    setIsEditing(false)
  }

  return (
    <AppLayout>
      <div className="p-6">
        {isEditing ? (
          <ChangeRequestForm
            changeId={params.id}
            onSubmit={handleFormSubmit}
            onCancel={handleFormCancel}
          />
        ) : (
          <ChangeRequestDetail
            changeId={params.id}
            onEdit={handleEdit}
            onBack={handleBack}
          />
        )}
      </div>
    </AppLayout>
  )
}