import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Heart, ExternalLink, Coffee, Utensils } from "lucide-react";
import { motion } from "framer-motion";

export default function GudDeo() {
  const hours = [
    { day: "Sunday", hours: "8:00 AM - 12:00 PM", open: true },
    { day: "Monday", hours: "Closed", open: false },
    { day: "Tuesday", hours: "Closed", open: false },
    { day: "Wednesday", hours: "9:00 AM - 2:00 PM", open: true },
    { day: "Thursday", hours: "Closed", open: false },
    { day: "Friday", hours: "Closed", open: false },
    { day: "Saturday", hours: "Closed", open: false }
  ];

  const menuItems = [
    { category: "Barista Beverages", icon: Coffee, items: ["Premium Coffee", "Lattes", "Cappuccinos", "Tea", "Cider", "Hot Cocoa"] },
    { category: "Self-Serve Food", icon: Utensils, items: ["Chips ($1.00)", "Candy ($1.50)", "Tornado ($2.00)", "Hot Dog ($3.00)"] },
    { category: "Beverages", icon: Coffee, items: ["Fountain Drinks ($1.50)", "Bottled Coke Products ($2.00)", "Monster Energy ($2.25)", "Starbucks Frappuccino ($2.25)"] }
  ];

  return (
    <div className="min-h-screen bg-[#D4BCB0] p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header with Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6 py-4"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="text-6xl font-bold tracking-wider text-[#6B4E3D]" style={{ fontFamily: 'Georgia, serif' }}>
              GUD DEO
            </div>
            <div className="flex flex-col items-center">
              <Coffee className="w-10 h-10 text-[#8B6F47]" />
              <div className="flex gap-2 mt-1">
                <div className="w-20 h-1 bg-[#8B6F47] transform -rotate-12 origin-right"></div>
                <div className="w-20 h-1 bg-[#8B6F47] transform rotate-12 origin-left"></div>
              </div>
            </div>
          </div>
          <p className="text-lg text-[#6B4E3D] max-w-2xl mx-auto font-medium">
            One cup at a time, one child at a time. Every purchase supports orphans in Sierra Leone.
          </p>
        </motion.div>

        {/* Mission Statement */}
        <Card className="border-0 bg-white/90 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Heart className="w-8 h-8 text-[#8B6F47] flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-xl text-[#6B4E3D] mb-3">Sierra Leone Orphan Sponsorship</h3>
                <p className="text-[#6B4E3D] leading-relaxed">
                  Bring hope, open doors, and turn dreams into realities that change a life and a world, one child at a time, one cup at a time. 
                  Every premium beverage and food item purchased provides essential support for an orphan in Sierra Leone. 
                  It costs just <strong>$1.23 a day</strong> to provide food, clothing, hygiene products, medical care, education, and a Bible for each child.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Online Button */}
        <Card className="bg-gradient-to-r from-[#C09F80] to-[#A6826B] text-white border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold mb-2">Order Online!</h3>
                <p className="text-white/95">Pick up in the café or grab & go!</p>
              </div>
              <Button
                onClick={() => window.open("https://www.guddeocafe.com/s/order", "_blank")}
                size="lg"
                className="bg-white text-[#6B4E3D] hover:bg-gray-50 font-semibold px-8"
              >
                <ExternalLink className="w-5 h-5 mr-2" />
                Order Now
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Hours */}
          <Card className="bg-white/90 border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#6B4E3D]">
                <Clock className="w-5 h-5 text-[#8B6F47]" />
                Hours of Operation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {hours.map((schedule) => (
                <div key={schedule.day} className="flex items-center justify-between p-3 rounded-lg bg-[#D4BCB0]/20">
                  <span className="font-medium text-[#6B4E3D]">{schedule.day}</span>
                  <div className="flex items-center gap-2">
                    {schedule.open && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        Open
                      </Badge>
                    )}
                    <span className={schedule.open ? "text-[#6B4E3D]" : "text-[#6B4E3D]/60"}>
                      {schedule.hours}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-amber-600" />
                Location & Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="font-medium text-slate-900">Gud Deo Café</p>
                <p className="text-slate-600">101 UTA Blvd</p>
                <p className="text-slate-600">Arlington, Texas 76010</p>
              </div>
              <div className="space-y-2">
                <p className="text-slate-600">
                  <strong>Phone:</strong> (817) 277-6353
                </p>
                <p className="text-slate-600">
                  <strong>Email:</strong> goodday@fbca.org
                </p>
              </div>
              <Button
                onClick={() => window.open("https://www.google.com/maps/dir/?api=1&destination=101+UTA+Blvd+Arlington+TX+76010", "_blank")}
                variant="outline"
                className="w-full"
              >
                <MapPin className="w-4 h-4 mr-2" />
                Get Directions
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Menu Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Utensils className="w-5 h-5 text-amber-600" />
                Menu Highlights
              </span>
              <Button
                onClick={() => window.open("https://www.fbca.org/gud-deo-cafe/", "_blank")}
                variant="outline"
                size="sm"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Full Menu
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {menuItems.map((section) => (
                <div key={section.category} className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="flex items-center gap-2 mb-3">
                    <section.icon className="w-5 h-5 text-amber-600" />
                    <h4 className="font-semibold text-slate-900">{section.category}</h4>
                  </div>
                  <ul className="space-y-2">
                    {section.items.map((item) => (
                      <li key={item} className="text-sm text-slate-600 flex items-start gap-2">
                        <span className="text-amber-500 mt-1">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Support Info */}
        <Card className="border-2 border-amber-300">
          <CardContent className="p-6">
            <div className="text-center space-y-3">
              <h3 className="text-xl font-semibold text-slate-900">Every Purchase Makes a Difference</h3>
              <p className="text-slate-600">
                Your support through Gud Deo Café directly impacts the lives of orphans in Sierra Leone, 
                providing them with hope, care, and a brighter future.
              </p>
              <div className="pt-2">
                <Button
                  onClick={() => window.open("https://www.fbca.org/gud-deo-cafe/", "_blank")}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  Learn More About Our Mission
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}