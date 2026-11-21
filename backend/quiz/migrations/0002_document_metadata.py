from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('quiz', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='document',
            name='name',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='document',
            name='page_count',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='document',
            name='size',
            field=models.PositiveIntegerField(default=0),
        ),
    ]
