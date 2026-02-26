import Nav from '@/components/landing/Nav';
import Hero from '@/components/landing/Hero';
import Marquee from '@/components/landing/Marquee';
import StatStrip from '@/components/landing/StatStrip';
import HowItWorks from '@/components/landing/HowItWorks';
import TierSection from '@/components/landing/TierSection';
import DashboardPreview from '@/components/landing/DashboardPreview';
import Pricing from '@/components/landing/Pricing';
import Footer from '@/components/landing/Footer';

export default function LandingPage() {
  return (
    <>
      {/* Ambient background layers */}
      <div className="noise-layer" aria-hidden="true" />
      <div className="orb orb-1" aria-hidden="true" />
      <div className="orb orb-2" aria-hidden="true" />
      <div className="orb orb-3" aria-hidden="true" />

      <Nav />

      <main>
        <Hero />
        <Marquee />
        <StatStrip />
        <HowItWorks />
        <TierSection />
        <DashboardPreview />
        <Pricing />
      </main>

      <Footer />
    </>
  );
}
