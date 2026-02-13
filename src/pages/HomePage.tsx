import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Newspaper,
  Plus,
  Pencil,
  Trash2,
  Info
} from 'lucide-react';
import homepageIllustration from '@/assets/homepage-illustration.jpg';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

interface NewsItem {
  id: string;
  title: string;
  content: string;
  published: boolean;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export default function HomePage() {
  const { user, loading, isAdmin, fullName } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loadingNews, setLoadingNews] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNews, setEditingNews] = useState<NewsItem | null>(null);
  const [saving, setSaving] = useState(false);
  
  
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [published, setPublished] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      loadNews();
    }
  }, [user]);



  async function loadNews() {
    try {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNews(data || []);
    } catch (error) {
      console.error('Error loading news:', error);
    } finally {
      setLoadingNews(false);
    }
  }

  function openCreateDialog() {
    setEditingNews(null);
    setTitle('');
    setContent('');
    setPublished(true);
    setDialogOpen(true);
  }

  function openEditDialog(item: NewsItem) {
    setEditingNews(item);
    setTitle(item.title);
    setContent(item.content);
    setPublished(item.published);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!title.trim() || !content.trim()) {
      toast({
        title: 'Fyll i alla fält',
        description: 'Titel och innehåll krävs.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      if (editingNews) {
        const { error } = await supabase
          .from('news')
          .update({
            title: title.trim(),
            content: content.trim(),
            published,
          })
          .eq('id', editingNews.id);

        if (error) throw error;
        toast({ title: 'Nyhet uppdaterad' });
      } else {
        const { error } = await supabase
          .from('news')
          .insert({
            title: title.trim(),
            content: content.trim(),
            published,
            created_by: user?.id,
            created_by_name: fullName || user?.email,
          });

        if (error) throw error;
        toast({ title: 'Nyhet skapad' });
      }

      setDialogOpen(false);
      loadNews();
    } catch (error) {
      console.error('Error saving news:', error);
      toast({
        title: 'Fel',
        description: 'Kunde inte spara nyheten.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Är du säker på att du vill ta bort denna nyhet?')) return;

    try {
      const { error } = await supabase
        .from('news')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Nyhet borttagen' });
      loadNews();
    } catch (error) {
      console.error('Error deleting news:', error);
      toast({
        title: 'Fel',
        description: 'Kunde inte ta bort nyheten.',
        variant: 'destructive',
      });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const publishedNews = news.filter(n => n.published);
  const displayNews = isAdmin ? news : publishedNews;

  return (
    <DashboardLayout>
      <div className="space-y-8 fade-in">
        {/* Welcome Section with System Update */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Välkommen{fullName ? `, ${fullName}` : ''}!
            </h1>
            <p className="text-muted-foreground mt-1">
              IT-Kostnadskalkylator – räkna fram och underhåll kalkyler på ett enkelt sätt
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
            <Info className="h-4 w-4 text-primary" />
            <span>Senaste systemuppdatering: 2 feb 2026</span>
          </div>
        </div>

        {/* Illustration */}
        <div className="rounded-2xl overflow-hidden shadow-lg max-h-48 sm:max-h-56">
          <img 
            src={homepageIllustration} 
            alt="IT-infrastruktur, nätverk, kostnadshantering" 
            className="w-full h-full object-cover object-center"
          />
        </div>

        {/* News Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Newspaper className="h-5 w-5 text-primary" />
                Nyheter
              </CardTitle>
              <CardDescription>
                Senaste nyheterna och uppdateringarna
              </CardDescription>
            </div>
            {isAdmin && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openCreateDialog} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Ny nyhet
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[525px]">
                  <DialogHeader>
                    <DialogTitle>
                      {editingNews ? 'Redigera nyhet' : 'Skapa ny nyhet'}
                    </DialogTitle>
                    <DialogDescription>
                      {editingNews 
                        ? 'Uppdatera nyhetens innehåll nedan.' 
                        : 'Fyll i information för den nya nyheten.'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="news-title">Titel</Label>
                      <Input
                        id="news-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ange en titel..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="news-content">Innehåll</Label>
                      <Textarea
                        id="news-content"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Skriv nyhetens innehåll..."
                        rows={5}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="news-published">Publicerad</Label>
                      <Switch
                        id="news-published"
                        checked={published}
                        onCheckedChange={setPublished}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Avbryt
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {editingNews ? 'Spara ändringar' : 'Skapa nyhet'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent>
            {loadingNews ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : displayNews.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Inga nyheter att visa just nu.
              </p>
            ) : (
              <div className="space-y-4">
                {displayNews.map((item) => (
                  <div
                    key={item.id}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{item.title}</h3>
                          {!item.published && isAdmin && (
                            <Badge variant="secondary">Utkast</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {item.created_by_name} • {format(new Date(item.created_at), 'd MMMM yyyy', { locale: sv })}
                        </p>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{item.content}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
