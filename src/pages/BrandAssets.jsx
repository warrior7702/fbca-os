import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import AppHeader from "@/components/shared/AppHeader";
import { Palette, Plus, Upload, Trash2, Image, Type, Droplet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function BrandAssets() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newAsset, setNewAsset] = useState({
    asset_type: "logo",
    name: "",
    file_url: "",
    color_hex: "",
    font_name: "",
    font_url: "",
    usage_notes: "",
    is_primary: false
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      const assetList = await base44.entities.BrandAsset.list();
      setAssets(assetList);
    } catch (error) {
      console.error("Error loading assets:", error);
      toast.error("Failed to load brand assets");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setNewAsset({ ...newAsset, file_url });
      toast.success("File uploaded!");
    } catch (error) {
      toast.error("Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleAddAsset = async () => {
    try {
      await base44.entities.BrandAsset.create(newAsset);
      toast.success("Brand asset added!");
      setShowAddDialog(false);
      setNewAsset({
        asset_type: "logo",
        name: "",
        file_url: "",
        color_hex: "",
        font_name: "",
        font_url: "",
        usage_notes: "",
        is_primary: false
      });
      loadAssets();
    } catch (error) {
      toast.error("Failed to add asset");
    }
  };

  const handleDeleteAsset = async (id) => {
    if (!confirm("Delete this brand asset?")) return;
    
    try {
      await base44.entities.BrandAsset.delete(id);
      toast.success("Asset deleted");
      loadAssets();
    } catch (error) {
      toast.error("Failed to delete asset");
    }
  };

  const assetsByType = {
    logo: assets.filter(a => a.asset_type === "logo"),
    icon: assets.filter(a => a.asset_type === "icon"),
    color: assets.filter(a => a.asset_type === "color"),
    font: assets.filter(a => a.asset_type === "font")
  };

  return (
    <div className="h-full bg-gradient-to-br from-purple-50 to-pink-50 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <AppHeader
          icon={Palette}
          title="Brand Assets"
          description="Manage FBCA brand guidelines, logos, colors, and fonts"
          iconColor="from-purple-500 to-pink-500"
          action={
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Asset
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add Brand Asset</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Asset Type</Label>
                    <Select
                      value={newAsset.asset_type}
                      onValueChange={(value) => setNewAsset({ ...newAsset, asset_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="logo">Logo</SelectItem>
                        <SelectItem value="icon">Icon</SelectItem>
                        <SelectItem value="color">Color</SelectItem>
                        <SelectItem value="font">Font</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Name</Label>
                    <Input
                      value={newAsset.name}
                      onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                      placeholder="e.g., Primary Logo, Brand Blue"
                    />
                  </div>

                  {(newAsset.asset_type === "logo" || newAsset.asset_type === "icon") && (
                    <div>
                      <Label>Upload File</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        disabled={uploading}
                      />
                      {newAsset.file_url && (
                        <img src={newAsset.file_url} alt="Preview" className="mt-2 h-20 object-contain" />
                      )}
                    </div>
                  )}

                  {newAsset.asset_type === "color" && (
                    <div>
                      <Label>Color Hex Code</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={newAsset.color_hex || "#000000"}
                          onChange={(e) => setNewAsset({ ...newAsset, color_hex: e.target.value })}
                          className="w-20"
                        />
                        <Input
                          value={newAsset.color_hex}
                          onChange={(e) => setNewAsset({ ...newAsset, color_hex: e.target.value })}
                          placeholder="#000000"
                        />
                      </div>
                    </div>
                  )}

                  {newAsset.asset_type === "font" && (
                    <>
                      <div>
                        <Label>Font Name</Label>
                        <Input
                          value={newAsset.font_name}
                          onChange={(e) => setNewAsset({ ...newAsset, font_name: e.target.value })}
                          placeholder="e.g., Inter, Roboto"
                        />
                      </div>
                      <div>
                        <Label>Font URL (Google Fonts or CDN)</Label>
                        <Input
                          value={newAsset.font_url}
                          onChange={(e) => setNewAsset({ ...newAsset, font_url: e.target.value })}
                          placeholder="https://fonts.googleapis.com/..."
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <Label>Usage Notes</Label>
                    <Textarea
                      value={newAsset.usage_notes}
                      onChange={(e) => setNewAsset({ ...newAsset, usage_notes: e.target.value })}
                      placeholder="Guidelines for using this asset..."
                      rows={3}
                    />
                  </div>

                  <Button onClick={handleAddAsset} disabled={!newAsset.name} className="w-full">
                    Add Asset
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          }
        />

        {/* Logos & Icons */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="w-5 h-5" />
                Logos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {assetsByType.logo.length === 0 ? (
                  <p className="text-sm text-slate-500">No logos uploaded yet</p>
                ) : (
                  assetsByType.logo.map((asset) => (
                    <motion.div
                      key={asset.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <img src={asset.file_url} alt={asset.name} className="h-12 object-contain" />
                        <div>
                          <p className="font-medium text-slate-900">{asset.name}</p>
                          {asset.usage_notes && (
                            <p className="text-xs text-slate-500">{asset.usage_notes}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteAsset(asset.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </motion.div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="w-5 h-5" />
                Icons
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {assetsByType.icon.length === 0 ? (
                  <p className="text-sm text-slate-500">No icons uploaded yet</p>
                ) : (
                  assetsByType.icon.map((asset) => (
                    <motion.div
                      key={asset.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <img src={asset.file_url} alt={asset.name} className="h-12 object-contain" />
                        <div>
                          <p className="font-medium text-slate-900">{asset.name}</p>
                          {asset.usage_notes && (
                            <p className="text-xs text-slate-500">{asset.usage_notes}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteAsset(asset.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </motion.div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Colors */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Droplet className="w-5 h-5" />
              Brand Colors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {assetsByType.color.length === 0 ? (
                <p className="text-sm text-slate-500 col-span-full">No colors defined yet</p>
              ) : (
                assetsByType.color.map((asset) => (
                  <motion.div
                    key={asset.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative"
                  >
                    <div
                      className="h-24 rounded-lg shadow-md mb-2"
                      style={{ backgroundColor: asset.color_hex }}
                    />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm text-slate-900">{asset.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{asset.color_hex}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteAsset(asset.id)}
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </Button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Fonts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Type className="w-5 h-5" />
              Typography
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {assetsByType.font.length === 0 ? (
                <p className="text-sm text-slate-500">No fonts defined yet</p>
              ) : (
                assetsByType.font.map((asset) => (
                  <motion.div
                    key={asset.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{asset.name}</p>
                      <p className="text-sm text-slate-600">{asset.font_name}</p>
                      {asset.usage_notes && (
                        <p className="text-xs text-slate-500 mt-1">{asset.usage_notes}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteAsset(asset.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </motion.div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}