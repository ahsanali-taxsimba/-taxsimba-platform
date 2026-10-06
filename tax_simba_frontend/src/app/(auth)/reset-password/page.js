import ResetPasswordPage from "./page.client"
import { Suspense } from "react"
export default function Page(){
  return (
    <>
        <Suspense fallback={<p className="text-center p-5">Loading password reset…</p>}>
          <ResetPasswordPage/>
        </Suspense>
    </>
  )
}