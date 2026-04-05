"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";

interface MatchCardExportProps {
  winnerName: string;
  loserName: string;
  matchTime: string;
  tierName: string;
  tierNumber: number;
  winnerImageUrl: string | null;
}

export function MatchCardExport({
  winnerName,
  loserName,
  matchTime,
  tierName,
  tierNumber,
  winnerImageUrl,
}: MatchCardExportProps) {
  const handleShare = useCallback(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // --- Background ---
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, 600, 400);

    // Subtle border/frame
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 12, 576, 376);

    // Inner subtle border
    ctx.strokeStyle = "rgba(212, 175, 55, 0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(18, 18, 564, 364);

    // Top gold accent line
    const topGrad = ctx.createLinearGradient(0, 0, 600, 0);
    topGrad.addColorStop(0, "transparent");
    topGrad.addColorStop(0.5, "#d4af37");
    topGrad.addColorStop(1, "transparent");
    ctx.fillStyle = topGrad;
    ctx.fillRect(12, 12, 576, 3);

    // --- "WINNER" label ---
    ctx.font = "bold 14px system-ui, -apple-system, sans-serif";
    ctx.letterSpacing = "6px";
    ctx.fillStyle = "rgba(212, 175, 55, 0.6)";
    ctx.textAlign = "center";
    ctx.fillText("W I N N E R", 300, 80);

    // --- Winner name with gold gradient ---
    const nameGrad = ctx.createLinearGradient(100, 100, 500, 140);
    nameGrad.addColorStop(0, "#f5d060");
    nameGrad.addColorStop(0.5, "#d4af37");
    nameGrad.addColorStop(1, "#f5d060");

    // Size the font based on name length
    const fontSize = winnerName.length > 20 ? 32 : winnerName.length > 14 ? 38 : 46;
    ctx.font = `900 ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = nameGrad;
    ctx.textAlign = "center";

    // Gold glow effect
    ctx.shadowColor = "rgba(212, 175, 55, 0.5)";
    ctx.shadowBlur = 20;
    ctx.fillText(winnerName, 300, 150);
    ctx.shadowBlur = 0;

    // --- "defeated" text ---
    ctx.font = "italic 18px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.textAlign = "center";
    ctx.fillText("defeated", 300, 200);

    // --- Loser name ---
    const loserFontSize = loserName.length > 20 ? 22 : loserName.length > 14 ? 26 : 30;
    ctx.font = `700 ${loserFontSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.textAlign = "center";
    ctx.fillText(loserName, 300, 245);

    // --- Divider line ---
    const divGrad = ctx.createLinearGradient(150, 0, 450, 0);
    divGrad.addColorStop(0, "transparent");
    divGrad.addColorStop(0.5, "rgba(212, 175, 55, 0.3)");
    divGrad.addColorStop(1, "transparent");
    ctx.fillStyle = divGrad;
    ctx.fillRect(150, 275, 300, 1);

    // --- Match time and tier ---
    ctx.font = "600 16px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.textAlign = "center";
    ctx.fillText(`${matchTime}  ·  T${tierNumber} ${tierName}`, 300, 310);

    // --- Branding ---
    ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "rgba(212, 175, 55, 0.35)";
    ctx.textAlign = "center";
    ctx.fillText("WWE 2K26 SIM LEAGUE", 300, 365);

    // --- Download ---
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `match-result-${winnerName.toLowerCase().replace(/\s+/g, "-")}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, "image/png");
  }, [winnerName, loserName, matchTime, tierName, tierNumber]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleShare}
      className="h-7 text-[11px] gap-1 text-gold/60 hover:text-gold hover:bg-gold/10"
    >
      📸 Share
    </Button>
  );
}
