import GridShape from "@/components/common/GridShape";
import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import React from "react";

export const metadata: Metadata = {
  title: "Admin | Tax Simba",
  description:
    "This is Admin page for Tax Simba",
};


export default function Home() {
  console.log("Rendering Home Page at /admin");
  return (
    <>
      <header className="main-header absolute top-0 left-0 right-0 z-100 py-3">
        <div className="container">
          <div className="header-wrapper flex items-center justify-between">
            <div className="header-logo">
              <a className="navbar-brand" href="#">
                <img src="./images/logo.svg" alt="Logo" />
              </a>
            </div>
            <ul className="navbar-nav me-auto mb-2 mb-lg-0 text-center d-none">
              <li className="nav-item">
                <a className="nav-link active" href="#">Home</a>
              </li>
            </ul>
            <form>
              <Link className="main-btn" href="/auth/signin">Sign In</Link>
            </form>
          </div>
        </div>
      </header>
      <section className="home-page min-h-screen flex items-center justify-center">
        <div className="container">
          <div className="home-inner-wrapper text-center">
            <h1 className="mb-0 text-uppercase">Welcome To <span> Tax Simba </span> </h1>
          </div>
        </div>
        <p className="footer-bottom text-white absolute text-sm text-center text-gray-500 -translate-x-1/2 bottom-6 left-1/2 dark:text-gray-400">
          &copy; {new Date().getFullYear()} <Link href="https://taxsimba.toxsl.in/" target="_blank" className="text-light-green">TAXSIMBA</Link> | All Rights Reserved.
        </p>
      </section>
    </>
  )
}
