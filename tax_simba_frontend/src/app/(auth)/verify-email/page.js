import React from 'react'
import VerifyEmail from './page.client'
import { Suspense } from 'react'

const page = () => {
  return (
    <div>
      <Suspense fallback={<p className="text-center p-5">Verifying your email…</p>}>
        <VerifyEmail />
      </Suspense>
    </div>
  )
}

export default page
