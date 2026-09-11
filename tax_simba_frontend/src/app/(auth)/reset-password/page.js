import ResetPasswordPage from "./page.client"
import { Suspense } from "react"
export default function Page(){
  return (
    <>
        <Suspense fallback={<p>Loading...</p>}>
          <ResetPasswordPage/>
        </Suspense>
    </>
  )
}