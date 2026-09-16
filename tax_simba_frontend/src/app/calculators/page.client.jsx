"use client";
import React from "react";
import Link from "next/link";
import {
    ShieldCheck, Briefcase, Wallet, Calculator, PiggyBank, Baby,
    AlertTriangle, Home, HardHat, ShoppingBag, Key, Car,
    Hash, MapPin, PieChart, Bitcoin, Building, ArrowRight
} from "lucide-react";
import { calculators } from "@/lib/calculators/metadata";
import { Card } from "@/components/ui/Base";
import "./calculators.css";
import { Col, Container, Row } from "react-bootstrap";
import { MdKeyboardDoubleArrowRight } from "react-icons/md";

const iconMap = {
    ShieldCheck: ShieldCheck,
    Briefcase: Briefcase,
    Wallet: Wallet,
    Calculator: Calculator,
    PiggyBank: PiggyBank,
    Baby: Baby,
    AlertTriangle: AlertTriangle,
    Home: Home,
    HardHat: HardHat,
    ShoppingBag: ShoppingBag,
    Key: Key,
    Car: Car,
    Hash: Hash,
    MapPin: MapPin,
    PieChart: PieChart,
    Bitcoin: Bitcoin,
    Building: Building,
};

export default function CalculatorsClient() {
    return (
        <>
            <section className="breadcrum-sec-top py-80">
                <Container>
                    <Row className="align-items-center">
                        <Col lg={6}>
                            <div className="bread-crum-inr-box text-lg-start text-center">
                                <h2 className="text-capitalize mb-3">Calculate Your Taxes Instantly</h2>
                                <p className="mb-0">From National Insurance contributions to mileage claims and Capital Gains Tax estimates — TaxSimba helps you calculate with confidence.</p>
                            </div>
                        </Col>
                        <Col lg={6}>
                            <div className="breadcrum-img text-center">
                                <img src="/images/calculate-bread.png" alt="Breadcrumb Image" className="img-fluid" />
                            </div>
                        </Col>
                    </Row>
                </Container>
            </section>

            <div className="calculator-main-wrapper ptb-80" id="calculator-root">
                <div className="container">
                    <div className="calcu-hdr text-center mb-5">
                        <h1>
                            <span>Premium</span> Tax Calculators
                        </h1>
                        <p className="text-muted">
                            Our expert tools help you navigate UK taxes, national insurance, and benefits with precision and elegance.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {calculators.map((calc, index) => {
                            const IconComponent = iconMap[calc.icon] || Calculator;
                            return (
                                <Link className="calculator-main-card h-full cursor-pointer" key={calc.slug} href={`/calculators/${calc.slug}`}>

                                    <div className="calc-icon">
                                        <IconComponent size={24} />

                                    </div>

                                    <IconComponent className="outer-icon" size={24} />
                                    <div className="cal-dis">
                                        <h3>
                                            {calc.name}
                                        </h3>
                                        <p>
                                            {calc.description}
                                        </p>
                                    </div>

                                </Link>
                            );
                        })}
                    </div>

                </div>
            </div>
        </>
    );
}
