import React from 'react'
import VerifyEmail from './page.client'
import { Suspense } from 'react'

const page = () => {
  return (
    <div>
      <Suspense>
        <VerifyEmail />
      </Suspense>
      
    </div>
  )
}

export default page
